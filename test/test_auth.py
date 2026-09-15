"""Auth routes: OAuth prompt flags, sliding session cookie, Google token refresh."""

import uuid
import urllib.parse
from datetime import datetime, timedelta
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from fastapi.testclient import TestClient
from jose import jwt

from src.api.main import app
from src.api.routes.auth import COOKIE_NAME, JWT_ALGORITHM, create_access_token
from src.config import settings
from src.db.session import get_db
from src.models.database import User


@pytest.fixture
def user(db):
    uid = uuid.uuid4().hex[:12]
    u = User(
        google_sub=f"auth-{uid}",
        email=f"auth-{uid}@example.com",
        display_name="Auth User",
        access_token="fake-access",
        refresh_token="fake-refresh",
        token_expiry=datetime.utcnow() - timedelta(hours=1),
    )
    db.add(u)
    db.commit()
    db.refresh(u)
    return u


@pytest.fixture
def auth_headers(user):
    token = create_access_token(user.id, user.email)
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture
def client(db):
    def override_get_db():
        yield db

    app.dependency_overrides[get_db] = override_get_db
    with TestClient(app) as c:
        yield c
    app.dependency_overrides.clear()


def _set_cookie_header(response) -> str:
    return (response.headers.get("set-cookie") or "").lower()


# ----- GET /api/auth/google -----


def test_google_auth_redirect_select_account(client):
    with patch.object(settings, "GOOGLE_CLIENT_ID", "test-client-id"):
        r = client.get("/api/auth/google", follow_redirects=False)
    assert r.status_code in (302, 307)
    loc = r.headers.get("location") or ""
    qs = urllib.parse.parse_qs(urllib.parse.urlparse(loc).query)
    assert qs.get("prompt") == ["select_account"]
    assert qs.get("include_granted_scopes") == ["true"]


def test_google_auth_force_consent_query(client):
    with patch.object(settings, "GOOGLE_CLIENT_ID", "test-client-id"):
        r = client.get("/api/auth/google?force_consent=1", follow_redirects=False)
    assert r.status_code in (302, 307)
    loc = r.headers.get("location") or ""
    qs = urllib.parse.parse_qs(urllib.parse.urlparse(loc).query)
    assert qs.get("prompt") == ["consent"]


def test_google_auth_composes_return_app_and_force_consent(client):
    with patch.object(settings, "GOOGLE_CLIENT_ID", "test-client-id"):
        r = client.get(
            "/api/auth/google?return_app=1&force_consent=true",
            follow_redirects=False,
        )
    assert r.status_code in (302, 307)
    loc = r.headers.get("location") or ""
    qs = urllib.parse.parse_qs(urllib.parse.urlparse(loc).query)
    assert qs.get("prompt") == ["consent"]
    cookies = r.headers.get("set-cookie") or ""
    assert "oauth_return_app" in cookies


def test_google_auth_503_without_client_id(client):
    with patch.object(settings, "GOOGLE_CLIENT_ID", None):
        r = client.get("/api/auth/google", follow_redirects=False)
    assert r.status_code == 503


# ----- GET /api/auth/me sliding cookie -----


def test_me_401_without_auth(client):
    r = client.get("/api/auth/me")
    assert r.status_code == 401


def test_me_does_not_slide_fresh_token(client, user):
    token = create_access_token(user.id, user.email)
    r = client.get("/api/auth/me", cookies={COOKIE_NAME: token})
    assert r.status_code == 200
    assert r.json()["email"] == user.email
    assert "token=" not in _set_cookie_header(r)


def test_me_slides_cookie_when_past_halfway(client, user):
    expire = datetime.utcnow() + timedelta(hours=1)
    token = jwt.encode(
        {"sub": str(user.id), "email": user.email, "exp": expire},
        settings.SECRET_KEY,
        algorithm=JWT_ALGORITHM,
    )
    r = client.get("/api/auth/me", cookies={COOKIE_NAME: token})
    assert r.status_code == 200
    assert r.json()["id"] == user.id
    set_cookie = _set_cookie_header(r)
    assert "token=" in set_cookie
    assert "httponly" in set_cookie


# ----- GET /api/auth/google-calendars refresh -----


@patch("src.api.routes.auth.refresh_google_token_if_needed")
@patch("src.api.routes.auth.httpx.AsyncClient")
def test_google_calendars_refreshes_token(mock_async_client, mock_refresh, client, user, auth_headers):
    mock_refresh.return_value = True
    mock_response = MagicMock()
    mock_response.status_code = 200
    mock_response.json.return_value = {
        "items": [{"id": "primary", "summary": "My Cal"}],
    }
    mock_get = AsyncMock(return_value=mock_response)
    mock_client_instance = MagicMock()
    mock_client_instance.get = mock_get
    mock_client_instance.__aenter__ = AsyncMock(return_value=mock_client_instance)
    mock_client_instance.__aexit__ = AsyncMock(return_value=None)
    mock_async_client.return_value = mock_client_instance

    r = client.get("/api/auth/google-calendars", headers=auth_headers)
    assert r.status_code == 200
    assert r.json() == [{"id": "primary", "summary": "My Cal"}]
    mock_refresh.assert_called_once()


def test_google_calendars_400_without_access_token(client, db, user, auth_headers):
    user.access_token = None
    user.refresh_token = None
    db.commit()
    r = client.get("/api/auth/google-calendars", headers=auth_headers)
    assert r.status_code == 400
    assert "token" in r.json()["detail"].lower()


@patch("src.api.routes.auth.httpx.Client")
def test_refresh_google_token_if_needed_posts_when_expired(mock_client_cls, db, user):
    from src.api.routes.auth import refresh_google_token_if_needed

    mock_resp = MagicMock()
    mock_resp.status_code = 200
    mock_resp.json.return_value = {"access_token": "new-access", "expires_in": 3600}
    instance = MagicMock()
    instance.post.return_value = mock_resp
    instance.__enter__.return_value = instance
    instance.__exit__.return_value = None
    mock_client_cls.return_value = instance

    assert refresh_google_token_if_needed(user, db) is True
    instance.post.assert_called_once()
    db.refresh(user)
    assert user.access_token is not None
    assert user.token_expiry > datetime.utcnow()
