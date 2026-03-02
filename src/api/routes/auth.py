"""Authentication: Google OAuth (state + PKCE), JWT via one-time code + HttpOnly cookie, current user."""

import base64
import hashlib
import secrets
import time
from datetime import datetime, timedelta
from urllib.parse import urlencode

import httpx
from fastapi import APIRouter, Depends, Header, HTTPException, Request
from fastapi.responses import RedirectResponse, Response
from jose import JWTError, jwt
from pydantic import BaseModel
from sqlalchemy.orm import Session

from src.config import settings
from src.db.session import get_db
from src.models.database import User
from src.services import token_encryption

router = APIRouter(prefix="/api/auth", tags=["auth"])

JWT_ALGORITHM = "HS256"
JWT_EXPIRE_HOURS = 168  # 1 week
COOKIE_NAME = "token"
COOKIE_MAX_AGE = 60 * 60 * 24 * 7  # 7 days
OAUTH_STATE_COOKIE = "oauth_state"
OAUTH_VERIFIER_COOKIE = "oauth_verifier"
CODE_TTL_SECONDS = 120

# One-time exchange codes: code -> (user_id, email, expiry_ts)
_exchange_codes: dict[str, tuple[int, str, float]] = {}


def _pkce_code_challenge(verifier: str) -> str:
    digest = hashlib.sha256(verifier.encode()).digest()
    return base64.urlsafe_b64encode(digest).decode().rstrip("=")


def _google_auth_url(state: str, code_challenge: str) -> str:
    params = {
        "client_id": settings.GOOGLE_CLIENT_ID,
        "redirect_uri": settings.GOOGLE_REDIRECT_URI,
        "response_type": "code",
        "scope": "openid email profile https://www.googleapis.com/auth/calendar.readonly https://www.googleapis.com/auth/calendar.events",
        "access_type": "offline",
        "prompt": "consent",
        "state": state,
        "code_challenge": code_challenge,
        "code_challenge_method": "S256",
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


def get_decrypted_access_token(user: User) -> str | None:
    """Return the decrypted access_token for use with Google APIs (e.g. events, calendar list)."""
    return token_encryption.decrypt_token(user.access_token)


def refresh_google_token_if_needed(user: User, db: Session) -> bool:
    """
    Refresh the user's Google access token if missing or expired (using refresh_token).
    Updates user.access_token and user.token_expiry in DB on success.
    Returns True if we have a valid token to use, False otherwise.
    """
    if not user or not user.refresh_token:
        return False
    ref_plain = token_encryption.decrypt_token(user.refresh_token)
    if not ref_plain:
        return False
    now = datetime.utcnow()
    if user.access_token and user.token_expiry and (user.token_expiry - now).total_seconds() > 300:
        return True

    with httpx.Client() as client:
        resp = client.post(
            "https://oauth2.googleapis.com/token",
            data={
                "client_id": settings.GOOGLE_CLIENT_ID,
                "client_secret": settings.GOOGLE_CLIENT_SECRET,
                "refresh_token": ref_plain,
                "grant_type": "refresh_token",
            },
            headers={"Content-Type": "application/x-www-form-urlencoded"},
        )
    if resp.status_code != 200:
        return False
    data = resp.json()
    new_access = data.get("access_token")
    if new_access:
        user.access_token = token_encryption.encrypt_token(new_access)
        user.token_expiry = now + timedelta(seconds=data.get("expires_in", 3600))
        db.commit()
        db.refresh(user)
        return True
    return False


def _token_from_request(request: Request, authorization: str | None) -> str | None:
    """Get JWT from cookie (preferred) or Authorization header."""
    cookie_token = request.cookies.get(COOKIE_NAME) if request else None
    if cookie_token:
        return cookie_token
    if authorization and authorization.startswith("Bearer "):
        return authorization.replace("Bearer ", "").strip()
    return None


def get_current_user(
    request: Request,
    authorization: str | None = Header(None),
    db: Session = Depends(get_db),
) -> User:
    """Dependency: current user from cookie or Bearer token. Raises 401 if missing or invalid."""
    token = _token_from_request(request, authorization)
    if not token:
        raise HTTPException(status_code=401, detail="Missing or invalid Authorization header or cookie")
    payload = decode_token(token)
    if not payload or "sub" not in payload:
        raise HTTPException(status_code=401, detail="Invalid or expired token")
    user_id = int(payload["sub"])
    user = db.get(User, user_id)
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    return user


@router.get("/google")
async def initiate_google_auth(response: Response):
    """Redirect to Google OAuth with state and PKCE. Sets oauth_state and oauth_verifier cookies."""
    if not settings.GOOGLE_CLIENT_ID:
        raise HTTPException(
            status_code=503,
            detail="Google OAuth not configured (GOOGLE_CLIENT_ID missing)",
        )
    state = secrets.token_urlsafe(32)
    code_verifier = secrets.token_urlsafe(32)
    code_challenge = _pkce_code_challenge(code_verifier)
    frontend_base = settings.frontend_base_url
    secure = frontend_base.startswith("https://") if frontend_base else False
    response = RedirectResponse(url=_google_auth_url(state, code_challenge))
    response.set_cookie(OAUTH_STATE_COOKIE, state, max_age=600, httponly=True, samesite="lax", secure=secure)
    response.set_cookie(OAUTH_VERIFIER_COOKIE, code_verifier, max_age=600, httponly=True, samesite="lax", secure=secure)
    return response


@router.get("/callback")
async def oauth_callback(
    code: str,
    state: str,
    request: Request,
    response: Response,
    db: Session = Depends(get_db),
):
    """Exchange code for tokens, create or get User, redirect to frontend with one-time ?code=."""
    if not settings.GOOGLE_CLIENT_ID or not settings.GOOGLE_CLIENT_SECRET:
        raise HTTPException(status_code=503, detail="Google OAuth not configured")

    state_cookie = request.cookies.get(OAUTH_STATE_COOKIE)
    verifier_cookie = request.cookies.get(OAUTH_VERIFIER_COOKIE)
    if not state_cookie or state != state_cookie or not verifier_cookie:
        raise HTTPException(status_code=400, detail="Invalid or missing OAuth state; try signing in again")

    async with httpx.AsyncClient() as client:
        token_resp = await client.post(
            "https://oauth2.googleapis.com/token",
            data={
                "code": code,
                "client_id": settings.GOOGLE_CLIENT_ID,
                "client_secret": settings.GOOGLE_CLIENT_SECRET,
                "redirect_uri": settings.GOOGLE_REDIRECT_URI,
                "grant_type": "authorization_code",
                "code_verifier": verifier_cookie,
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
            refresh_token=token_encryption.encrypt_token(token_data.get("refresh_token")),
            access_token=token_encryption.encrypt_token(access_token),
            token_expiry=datetime.utcnow() + timedelta(seconds=token_data.get("expires_in", 3600)),
        )
        db.add(user)
    else:
        user.display_name = name or user.display_name
        user.avatar_url = picture or user.avatar_url
        user.access_token = token_encryption.encrypt_token(access_token)
        if token_data.get("refresh_token"):
            user.refresh_token = token_encryption.encrypt_token(token_data["refresh_token"])
        user.token_expiry = datetime.utcnow() + timedelta(
            seconds=token_data.get("expires_in", 3600)
        )
    db.commit()
    db.refresh(user)

    # One-time code for frontend to exchange for cookie
    exchange_code = secrets.token_urlsafe(32)
    _exchange_codes[exchange_code] = (user.id, user.email, time.time() + CODE_TTL_SECONDS)
    frontend_callback = f"{settings.frontend_base_url}/login/callback"
    redirect = RedirectResponse(url=f"{frontend_callback}?code={exchange_code}")
    redirect.delete_cookie(OAUTH_STATE_COOKIE)
    redirect.delete_cookie(OAUTH_VERIFIER_COOKIE)
    return redirect


class ExchangeBody(BaseModel):
    code: str


@router.post("/exchange")
async def exchange_code(body: ExchangeBody, response: Response):
    """Exchange one-time code for session. Sets HttpOnly cookie with JWT. Call with credentials."""
    code = body.code
    if not code:
        raise HTTPException(status_code=400, detail="Missing or invalid code")
    entry = _exchange_codes.pop(code, None)
    if not entry:
        raise HTTPException(status_code=400, detail="Invalid or expired code")
    user_id, email, expiry = entry
    if time.time() > expiry:
        raise HTTPException(status_code=400, detail="Code expired")
    jwt_token = create_access_token(user_id, email)
    frontend_base = settings.frontend_base_url
    secure = frontend_base.startswith("https://") if frontend_base else False
    response = Response(status_code=204)
    response.set_cookie(
        COOKIE_NAME,
        jwt_token,
        max_age=COOKIE_MAX_AGE,
        httponly=True,
        samesite="lax",
        secure=secure,
        path="/",
    )
    return response


@router.post("/logout")
async def logout(response: Response):
    """Clear the session cookie. Call with credentials."""
    resp = Response(status_code=204)
    resp.delete_cookie(COOKIE_NAME, path="/")
    return resp


@router.get("/me")
def get_current_user_info(
    request: Request,
    authorization: str | None = Header(None),
    db: Session = Depends(get_db),
):
    """Return current user from cookie or Bearer token. Returns 401 if invalid."""
    token = _token_from_request(request, authorization)
    if not token:
        raise HTTPException(status_code=401, detail="Missing or invalid Authorization header or cookie")
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


@router.get("/google-calendars")
async def list_google_calendars(current_user: User = Depends(get_current_user)):
    """List the current user's Google calendars. Uses decrypted access token."""
    access_token = get_decrypted_access_token(current_user)
    if not access_token:
        raise HTTPException(
            status_code=400,
            detail="No Google access token. Sign out and sign in again with Google to grant calendar access.",
        )
    async with httpx.AsyncClient() as client:
        resp = await client.get(
            "https://www.googleapis.com/calendar/v3/users/me/calendarList",
            headers={"Authorization": f"Bearer {access_token}"},
        )
    if resp.status_code == 401:
        raise HTTPException(
            status_code=401,
            detail="Google token expired or invalid. Sign out and sign in again.",
        )
    if resp.status_code != 200:
        raise HTTPException(
            status_code=502,
            detail=f"Google Calendar API error: {resp.status_code}",
        )
    data = resp.json()
    items = data.get("items") or []
    return [
        {"id": item["id"], "summary": item.get("summary", item["id"])}
        for item in items
    ]
