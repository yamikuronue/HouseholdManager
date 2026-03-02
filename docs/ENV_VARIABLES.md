# Environment Variables Reference

Quick reference for all environment variables needed for Lionfish deployment.

## Required Secrets (Set in DigitalOcean App Platform Console)

These must be set as **encrypted secrets** in App Platform console:

| Variable | Description | Where to Get It |
|----------|-------------|-----------------|
| `GOOGLE_CLIENT_ID` | Google OAuth Client ID | Google Cloud Console → APIs & Services → Credentials |
| `GOOGLE_CLIENT_SECRET` | Google OAuth Client Secret | Google Cloud Console → APIs & Services → Credentials |
| `SECRET_KEY` | Application secret key for encryption | Generate: `python scripts/generate-secret-key.py` |
| `DATABASE_URL` | Database connection string | Auto-set if using managed DB, or set manually |

## Configuration Variables (Update After Deployment)

These should be updated with your actual deployment URLs:

| Variable | Description | Example |
|----------|-------------|---------|
| `GOOGLE_REDIRECT_URI` | OAuth callback URL | `https://your-backend.ondigitalocean.app/api/auth/callback` |
| `FRONTEND_URL` | Frontend URL for CORS | `https://your-frontend.ondigitalocean.app` |
| `VITE_API_URL` | Backend API URL (frontend) | `https://your-backend.ondigitalocean.app` |

## Optional Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `API_HOST` | Backend host | `0.0.0.0` |
| `API_PORT` | Backend port | `8080` |
| `ENVIRONMENT` | Environment indicator | `production` |
| `ENCRYPTION_KEY` | Fernet key for encrypting refresh/access tokens at rest (recommended in production) | Not set (tokens stored plain) |
| `ENCRYPTION_KEY_PREVIOUS` | Old Fernet key when rotating; used only to decrypt existing tokens | Not set |

To generate a Fernet key: `python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"`. Store as an encrypted secret in production.

**Rotating the key:** Set `ENCRYPTION_KEY_PREVIOUS` to the old key and `ENCRYPTION_KEY` to a new key, then deploy. Existing tokens still decrypt (via previous key); new tokens use the new key. Once you no longer need to read old ciphertexts, remove `ENCRYPTION_KEY_PREVIOUS`.

## Invitation emails (Mailjet, optional)

To send invitation emails when someone clicks **Send invite** (or **Resend**), set Mailjet API credentials. If not set, the invite is still created and the link can be copied manually.

| Variable | Description | Example |
|----------|-------------|---------|
| `MAILJET_API_KEY` | Mailjet API key | From [Mailjet Account Settings](https://app.mailjet.com/account/api_keys) |
| `MAILJET_SECRET_KEY` | Mailjet Secret key | From same page; store as **encrypted** secret |
| `MAIL_FROM` | Sender email (must be verified in Mailjet) | `noreply@lionfish.cloud` |
| `MAIL_FROM_NAME` | Sender display name | `Lionfish` |

Get API key and Secret from [Mailjet](https://www.mailjet.com/) → Account → API Keys. Verify your sender email/domain in Mailjet so messages are delivered.

## Setting Variables in DigitalOcean App Platform

### Via Web Console:

1. Go to your app → **Settings** → **App-Level Environment Variables**
2. Click **Edit**
3. For secrets:
   - Click **Add Variable**
   - Enter key name
   - Enter value
   - **Check "Encrypted" checkbox** ⚠️ Important!
   - Click **Save**
4. For regular variables:
   - Click **Add Variable**
   - Enter key and value
   - Leave "Encrypted" unchecked
   - Click **Save**

### Via doctl CLI:

```bash
# Set encrypted secret
doctl apps update $APP_ID --spec app.yaml

# Note: For secrets, it's easier to set via web console
```

## Local Development (.env file)

For local development, create a `.env` file in the project root:

```env
# Google OAuth
GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your-client-secret
GOOGLE_REDIRECT_URI=http://localhost:8000/api/auth/callback

# Database
DATABASE_URL=sqlite:///./household_manager.db

# Security
SECRET_KEY=your-local-secret-key

# Frontend
FRONTEND_URL=http://localhost:3000

# Invitation emails via Mailjet (optional; omit to skip sending)
# MAILJET_API_KEY=your-api-key
# MAILJET_SECRET_KEY=your-secret-key
# MAIL_FROM=noreply@yourdomain.com
# MAIL_FROM_NAME=Lionfish
```

**⚠️ Never commit `.env` to git!** It's already in `.gitignore`.

## Verification

After setting variables, verify they're loaded:

```bash
# Check backend logs
doctl apps logs $APP_ID --component backend --type run

# Or visit API docs
https://your-backend.ondigitalocean.app/docs
```

## Troubleshooting Missing Variables

If variables aren't loading:

1. **Check variable names** - Must match exactly (case-sensitive)
2. **Verify scope** - `RUN_TIME` vs `BUILD_TIME` (VITE_API_URL needs BUILD_TIME)
3. **Check encryption** - Secrets should be marked as encrypted
4. **Redeploy** - Some changes require redeployment
5. **Check logs** - Look for configuration errors
