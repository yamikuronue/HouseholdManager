"""Authentication: Google OAuth, JWT, and current user."""

from datetime import datetime, timedelta
from urllib.parse import urlencode

import httpx
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import RedirectResponse
from jose import JWTError, jwt
from sqlalchemy.orm import Session

from src.config import settings
from src.db.session import get_db
from src.models.database import User

router = APIRouter(prefix="/api/auth", tags=["auth"])

JWT_ALGORITHM = "HS256"
JWT_EXPIRE_HOURS = 168  # 1 week


def _google_auth_url() -> str:
    params = {
        "client_id": settings.GOOGLE_CLIENT_ID,
        "redirect_uri": settings.GOOGLE_REDIRECT_URI,
        "response_type": "code",
        "scope": "openid email profile https://www.googleapis.com/auth/calendar.readonly",
        "access_type": "offline",
        "prompt": "consent",
    }
    return f"https://accounts.google.com/o/oauth2/v2/auth?{urlencode(params)}"


def create_access_token(user_id: int, email: str) -> str:
    expire = datetime.utcnow() + timedelta(hours=JWT_EXPIRE_HOURS)
    payload = {"sub": str(user_id), "email": email, "exp": expire}
    return jwt.encode(payload, settings.SECRET_KEY, algorithm=JWT_ALGORITHM)


def decode_token(token: str) -> dict | None:
    try:
        return jwt.decode(token, settings.SECRET_KEY, algorithms=[JWT_ALGORITHM])
    except JWTError:
        return None


@router.get("/google")
async def initiate_google_auth():
    """Redirect to Google OAuth. After login, Google redirects to /api/auth/callback."""
    if not settings.GOOGLE_CLIENT_ID:
        raise HTTPException(
            status_code=503,
            detail="Google OAuth not configured (GOOGLE_CLIENT_ID missing)",
        )
    return RedirectResponse(url=_google_auth_url())


@router.get("/callback")
async def oauth_callback(code: str, db: Session = Depends(get_db)):
    """Exchange code for tokens, create or get User, redirect to frontend with JWT."""
    if not settings.GOOGLE_CLIENT_ID or not settings.GOOGLE_CLIENT_SECRET:
        raise HTTPException(status_code=503, detail="Google OAuth not configured")

    async with httpx.AsyncClient() as client:
        token_resp = await client.post(
            "https://oauth2.googleapis.com/token",
            data={
                "code": code,
                "client_id": settings.GOOGLE_CLIENT_ID,
                "client_secret": settings.GOOGLE_CLIENT_SECRET,
                "redirect_uri": settings.GOOGLE_REDIRECT_URI,
                "grant_type": "authorization_code",
            },
            headers={"Content-Type": "application/x-www-form-urlencoded"},
        )
    if token_resp.status_code != 200:
        raise HTTPException(status_code=400, detail="Failed to exchange code for token")

    token_data = token_resp.json()
    access_token = token_data.get("access_token")
    if not access_token:
        raise HTTPException(status_code=400, detail="No access token in response")

    async with httpx.AsyncClient() as client:
        userinfo_resp = await client.get(
            "https://www.googleapis.com/oauth2/v2/userinfo",
            headers={"Authorization": f"Bearer {access_token}"},
        )
    if userinfo_resp.status_code != 200:
        raise HTTPException(status_code=400, detail="Failed to fetch user info")

    userinfo = userinfo_resp.json()
    google_sub = userinfo.get("id")
    email = userinfo.get("email", "")
    name = userinfo.get("name")
    picture = userinfo.get("picture")

    if not google_sub or not email:
        raise HTTPException(status_code=400, detail="Missing id or email from Google")

    user = db.query(User).filter(User.google_sub == google_sub).first()
    if not user:
        user = User(
            google_sub=google_sub,
            email=email,
            display_name=name,
            avatar_url=picture,
            refresh_token=token_data.get("refresh_token"),
            access_token=access_token,
            token_expiry=datetime.utcnow() + timedelta(seconds=token_data.get("expires_in", 3600)),
        )
        db.add(user)
    else:
        user.display_name = name or user.display_name
        user.avatar_url = picture or user.avatar_url
        user.access_token = access_token
        if token_data.get("refresh_token"):
            user.refresh_token = token_data["refresh_token"]
        user.token_expiry = datetime.utcnow() + timedelta(
            seconds=token_data.get("expires_in", 3600)
        )
    db.commit()
    db.refresh(user)

    jwt_token = create_access_token(user.id, user.email)
    frontend_callback = f"{settings.frontend_base_url}/login/callback"
    return RedirectResponse(url=f"{frontend_callback}?token={jwt_token}")


@router.get("/me")
def get_current_user_info(
    authorization: str | None = None,
    db: Session = Depends(get_db),
):
    """
    Return current user from Bearer token. No auth required in path; returns 401 if invalid.
    """
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing or invalid Authorization header")
    token = authorization.replace("Bearer ", "").strip()
    payload = decode_token(token)
    if not payload or "sub" not in payload:
        raise HTTPException(status_code=401, detail="Invalid or expired token")
    user_id = int(payload["sub"])
    user = db.get(User, user_id)
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    return {
        "id": user.id,
        "email": user.email,
        "display_name": user.display_name,
        "avatar_url": user.avatar_url,
        "google_sub": user.google_sub,
    }
