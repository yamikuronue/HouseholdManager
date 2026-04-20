"""OAuth helpers for Android WebView / Custom Tabs."""

from src.api.routes import auth


def test_android_oauth_intent_url_shape():
    url = auth._android_oauth_intent_url("test-code-xyz")
    assert url is not None
    assert url.startswith("intent://")
    assert "test-code-xyz" in url
    assert "package=" in url
    assert "S.browser_fallback_url=" in url
