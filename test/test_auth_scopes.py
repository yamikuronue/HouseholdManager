import urllib.parse

from src.api.routes.auth import _google_auth_url


def test_google_auth_url_does_not_request_openid():
    url = _google_auth_url("state123", "verifier123")
    parsed = urllib.parse.urlparse(url)
    qs = urllib.parse.parse_qs(parsed.query)
    scope = qs.get("scope", [""])[0]

    assert "openid" not in scope
    assert "https://www.googleapis.com/auth/userinfo.email" in scope
    assert "https://www.googleapis.com/auth/userinfo.profile" in scope
    assert "https://www.googleapis.com/auth/calendar.readonly" in scope
    assert "https://www.googleapis.com/auth/calendar.events" in scope

