"""Authentication routes for Google OAuth."""

from fastapi import APIRouter

router = APIRouter(prefix="/api/auth", tags=["auth"])


@router.get("/google")
async def initiate_google_auth():
    """Initiate Google OAuth flow."""
    # TODO: Implement OAuth initiation
    return {"auth_url": "https://accounts.google.com/o/oauth2/auth?..."}


@router.get("/callback")
async def oauth_callback(code: str):
    """Handle OAuth callback from Google."""
    # TODO: Implement OAuth callback handling
    return {"message": "Authentication successful", "code": code}
