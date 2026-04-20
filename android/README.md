# Lionfish Android (WebView MVP)

Minimal Android shell for [Lionfish](https://lionfish.cloud): `WebView` + **Chrome Custom Tabs** for Google OAuth.

## Requirements

- Android Studio Koala+ (or newer) with JDK 17
- Android SDK 34

## Open the project

1. **File → Open** and select this `android/` folder.
2. Let Gradle sync. If the Gradle wrapper is missing, use **File → Settings → Build, Execution, Deployment → Gradle** and use the bundled Gradle, or run **Gradle → Wrapper** from the IDE.
3. Run on an emulator or device (**Run** ▶).

## Behavior

- Loads `https://lionfish.cloud/` in a `WebView`.
- Appends `LionfishWebView/1.0` to the User-Agent so the web app calls `/api/auth/google?return_app=1`.
- Intercepts `/api/auth/google` and opens it in a **Custom Tab** (Google blocks embedded WebView sign-in).
- After OAuth, the server issues an **`intent://`** redirect; the app opens and loads `/login/callback?code=…` in the WebView so `POST /api/auth/exchange` sets the session cookie in the WebView.
- **App Links** for `https://lionfish.cloud/login/callback` and `/invite…` (verify with `.well-known/assetlinks.json` — see [docs/ANDROID_WEBVIEW.md](../docs/ANDROID_WEBVIEW.md)).

## Release signing & App Links

1. Configure a release keystore in Android Studio (**Build → Generate Signed App Bundle**).
2. Run `./gradlew signingReport` and copy the **SHA-256** for your **release** key into  
   `frontend/public/.well-known/assetlinks.json`, then redeploy the website.
3. Ensure `ANDROID_APP_PACKAGE` on the server matches `applicationId` (`cloud.lionfish.app` by default).

## Package name

Default `applicationId`: `cloud.lionfish.app`. If you change it, update:

- `ANDROID_APP_PACKAGE` in server env / `app.yaml`
- `assetlinks.json` `package_name`
- Google Play / signing reports
