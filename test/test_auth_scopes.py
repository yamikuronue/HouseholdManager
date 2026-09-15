import time
import urllib.parse

from src.api.routes.auth import (
    JWT_EXPIRE_HOURS,
    _google_auth_url,
    _jwt_should_slide,
    _truthy_query,
)
from src.services.auth import AuthService


def _qs(url: str) -> dict:
    parsed = urllib.parse.urlparse(url)
    return urllib.parse.parse_qs(parsed.query)


def test_google_auth_url_does_not_request_openid():
    url = _google_auth_url("state123", "verifier123")
    qs = _qs(url)
    scope = qs.get("scope", [""])[0]

    assert "openid" not in scope
    assert "https://www.googleapis.com/auth/userinfo.email" in scope
    assert "https://www.googleapis.com/auth/userinfo.profile" in scope
    assert "https://www.googleapis.com/auth/calendar.readonly" in scope
    assert "https://www.googleapis.com/auth/calendar.events" in scope


def test_google_auth_url_default_select_account_not_consent():
    qs = _qs(_google_auth_url("state123", "verifier123"))
    assert qs.get("prompt") == ["select_account"]
    assert qs.get("access_type") == ["offline"]
    assert qs.get("include_granted_scopes") == ["true"]


def test_google_auth_url_force_consent():
    qs = _qs(_google_auth_url("state123", "verifier123", force_consent=True))
    assert qs.get("prompt") == ["consent"]
    assert qs.get("access_type") == ["offline"]
    assert qs.get("include_granted_scopes") == ["true"]


def test_auth_service_stubs():
    svc = AuthService("cid", "secret", "http://localhost/callback")
    assert svc.exchange_code_for_token("code") == {}
    assert svc.refresh_access_token("refresh") == {}


def test_truthy_query():
    assert _truthy_query("1") is True
    assert _truthy_query("true") is True
    assert _truthy_query("YES") is True
    assert _truthy_query("0") is False
    assert _truthy_query(None) is False
    assert _truthy_query("no") is False


def test_jwt_should_slide_when_past_halfway():
    remaining_hours = JWT_EXPIRE_HOURS / 4
    payload = {"exp": time.time() + remaining_hours * 3600}
    assert _jwt_should_slide(payload) is True


def test_jwt_should_not_slide_when_fresh():
    payload = {"exp": time.time() + JWT_EXPIRE_HOURS * 3600}
    assert _jwt_should_slide(payload) is False


def test_jwt_should_not_slide_without_exp():
    assert _jwt_should_slide({}) is False

