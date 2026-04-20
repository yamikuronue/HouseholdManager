# Deployment URLs

**Canonical production host:** `https://lionfish.cloud`  
Use this host for `GOOGLE_REDIRECT_URI`, `FRONTEND_URL`, and Google Cloud OAuth redirect URIs so cookies, CORS, and OAuth redirects stay consistent.

| Purpose            | URL |
|--------------------|-----|
| App (SPA + API)    | https://lionfish.cloud/ |
| Health check       | https://lionfish.cloud/health |
| API docs (Swagger) | https://lionfish.cloud/docs |

**Legacy DigitalOcean default hostname** (only if you still point DNS or env vars at it):

| Purpose | URL |
|---------|-----|
| App     | https://lionfish-app-uhfes.ondigitalocean.app/ |

**Google OAuth:**  
Add this exact redirect URI in [Google Cloud Console](https://console.cloud.google.com/apis/credentials) for your OAuth 2.0 **Web application** client:

```
https://lionfish.cloud/api/auth/callback
```

If you still use the App Platform URL directly, also register:

```
https://lionfish-app-uhfes.ondigitalocean.app/api/auth/callback
```

Ensure `GOOGLE_REDIRECT_URI` in your host (e.g. DigitalOcean) matches **one** of the URIs above—the chosen value must match the browser URL that starts the OAuth flow so `frontend_base_url` and session cookies align.

See also: [ANDROID_WEBVIEW.md](ANDROID_WEBVIEW.md) for the Android wrapper and `ANDROID_APP_PACKAGE`.
