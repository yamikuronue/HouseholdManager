# Deployment URLs

**Live app (DigitalOcean App Platform):**

| Purpose        | URL |
|----------------|-----|
| API (root)     | https://lionfish-app-uhfes.ondigitalocean.app/ |
| Health check   | https://lionfish-app-uhfes.ondigitalocean.app/health |
| API docs (Swagger) | https://lionfish-app-uhfes.ondigitalocean.app/docs |

**Google OAuth:**  
Add this exact redirect URI in [Google Cloud Console](https://console.cloud.google.com/apis/credentials) for your OAuth 2.0 Client ID:

```
https://lionfish-app-uhfes.ondigitalocean.app/api/auth/callback
```

Ensure `GOOGLE_REDIRECT_URI` in DigitalOcean is set to the same value (already set in `app.yaml`).
