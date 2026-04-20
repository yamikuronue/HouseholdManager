# Android WebView MVP (Lionfish)

This doc matches the WebView wrapper in [`android/`](../android/README.md): load `https://lionfish.cloud` in a `WebView`, run **Google sign-in in Chrome Custom Tabs** (embedded WebView is blocked by Google), then return to the app so the **session cookie is created inside the WebView**.

## Flow

1. User taps **Login** in the WebView. The frontend requests `/api/auth/google?return_app=1` when the User-Agent contains `LionfishWebView/` (set by the Android app).
2. The app intercepts navigation to `/api/auth/google` and opens the **same URL** in a **Custom Tab** (cookies + PKCE for that flow live in Chrome).
3. After Google OAuth, the server redirects with an **`intent://…#Intent;package=…`** URL (see `ANDROID_APP_PACKAGE` / `src/api/routes/auth.py`) so Chrome can open the native app. `S.browser_fallback_url` is the normal HTTPS `/login/callback?code=…` if the app is not installed.
4. The app receives the **https** deep link (`/login/callback?code=…`) and loads it in the **WebView**. The existing React page calls `POST /api/auth/exchange` and sets the **HttpOnly** session cookie in the WebView.

## Environment

| Variable | Purpose |
|----------|---------|
| `GOOGLE_REDIRECT_URI` | Must be `https://lionfish.cloud/api/auth/callback` (or your single canonical origin + `/api/auth/callback`). |
| `FRONTEND_URL` | Must match that origin (e.g. `https://lionfish.cloud`). |
| `ANDROID_APP_PACKAGE` | Must equal the Android app `applicationId` (default `cloud.lionfish.app`). |

## Digital Asset Links

For verified **Android App Links**, host a statement at:

`https://lionfish.cloud/.well-known/assetlinks.json`

The Vite build copies [`frontend/public/.well-known/assetlinks.json`](../frontend/public/.well-known/assetlinks.json) into the static site. Replace `sha256_cert_fingerprints` with your **release** signing key SHA-256 from:

```bash
cd android && ./gradlew signingReport
```

Redeploy the web app after updating the file.

## Focused acceptance checks

- [ ] **Fresh install:** open app → login → Custom Tab → land in app on dashboard after callback.
- [ ] **Return from Custom Tab:** intent opens app (not stuck in Chrome only).
- [ ] **Session persistence:** kill app, reopen — still logged in (cookie).
- [ ] **Logout / login again:** no stale PKCE cookies; second login works.
- [ ] **Invite link:** open `https://lionfish.cloud/invite/accept?token=…` from email → resolves to app (App Link or “Open with”).

## Play Console / policy

- Provide a **Privacy Policy** URL (see `docs/PRIVACY.md` on the site).
- Declare **Google** sign-in and data use in Data safety.
