# DigitalOcean App Platform Setup Guide

Complete step-by-step guide for deploying HouseholdManager to DigitalOcean App Platform with Google Calendar API integration.

## Prerequisites

1. **DigitalOcean Account** - Sign up at https://www.digitalocean.com
2. **GitHub Repository** - Your code pushed to GitHub
3. **Google Cloud Project** - With Calendar API enabled
4. **doctl CLI** (optional) - For command-line deployment

## Step 1: Prepare Google Cloud Credentials

### 1.1 Enable Google Calendar API

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Select or create a project
3. Navigate to **APIs & Services** > **Library**
4. Search for "Google Calendar API"
5. Click **Enable**

### 1.2 Create OAuth 2.0 Credentials

1. Go to **APIs & Services** > **Credentials**
2. Click **Create Credentials** > **OAuth client ID**
3. If prompted, configure OAuth consent screen:
   - User Type: **External** (or Internal if using Google Workspace)
   - App name: **HouseholdManager**
   - User support email: Your email
   - Developer contact: Your email
   - Click **Save and Continue** through scopes and test users
4. Create OAuth Client ID:
   - Application type: **Web application**
   - Name: **HouseholdManager Production**
   - Authorized redirect URIs:
     - `http://localhost:8000/api/auth/callback` (for local dev)
     - `https://your-backend.ondigitalocean.app/api/auth/callback` (update after deployment)
   - Click **Create**
5. **Save these values:**
   - **Client ID**: `xxxxx.apps.googleusercontent.com`
   - **Client Secret**: `xxxxx`

## Step 2: Generate Application Secret Key

Generate a secure secret key for your application:

```bash
python scripts/generate-secret-key.py
```

Or manually:
```bash
python -c "import secrets; print(secrets.token_urlsafe(32))"
```

**Save this value** - you'll need it for App Platform.

## Step 3: Update app.yaml

1. Open `app.yaml` in your repository
2. Update the following:
   - Replace `your-username/HouseholdManager` with your actual GitHub username/repo (2 places)
   - Choose your preferred region (default: `nyc`)
   - Optionally uncomment the database section if you want a managed PostgreSQL database

## Step 4: Deploy to DigitalOcean App Platform

### Option A: Using Web Console (Recommended for First Deployment)

1. **Create App:**
   - Go to https://cloud.digitalocean.com/apps
   - Click **Create App**
   - Select **GitHub** as source
   - Authorize DigitalOcean to access your GitHub if needed
   - Select your repository: `HouseholdManager`
   - Select branch: `main`

2. **Configure App:**
   - Click **Edit** next to "App Spec"
   - Copy and paste the contents of `app.yaml`
   - Click **Next**

3. **Set Environment Variables:**
   - Go to **Settings** > **App-Level Environment Variables**
   - Add the following **encrypted secrets**:
     
     | Key | Value | Type |
     |-----|-------|------|
     | `GOOGLE_CLIENT_ID` | Your Google Client ID | Encrypted |
     | `GOOGLE_CLIENT_SECRET` | Your Google Client Secret | Encrypted |
     | `SECRET_KEY` | Generated secret key | Encrypted |
     | `DATABASE_URL` | (Leave empty if using managed DB) | Encrypted |

   - **Important:** Mark each as **"Encrypted"** type
   - Click **Save**

4. **Configure Database (Optional):**
   - If you uncommented the database section in `app.yaml`, it will be created automatically
   - The `DATABASE_URL` will be automatically injected

5. **Deploy:**
   - Review your configuration
   - Click **Create Resources**
   - Wait for deployment (5-10 minutes)

### Option B: Using doctl CLI

1. **Install doctl:**
   ```bash
   # Windows (using Chocolatey)
   choco install doctl
   
   # macOS (using Homebrew)
   brew install doctl
   
   # Linux
   # Download from https://github.com/digitalocean/doctl/releases
   ```

2. **Authenticate:**
   ```bash
   doctl auth init
   ```
   Enter your DigitalOcean API token (get from https://cloud.digitalocean.com/account/api/tokens)

3. **Deploy:**
   ```bash
   doctl apps create --spec app.yaml
   ```

4. **Set Environment Variables:**
   ```bash
   # Get your app ID from the output above
   APP_ID=your-app-id
   
   # Set secrets (you'll be prompted for values)
   doctl apps update $APP_ID --spec app.yaml
   ```
   
   Or set via web console (easier for secrets).

## Step 5: Post-Deployment Configuration

### 5.1 Get Your App URLs

After deployment, note your app URLs:
- Backend: `https://household-manager-backend-xxxxx.ondigitalocean.app`
- Frontend: `https://household-manager-frontend-xxxxx.ondigitalocean.app`

### 5.2 Update Google Cloud Console

1. Go back to [Google Cloud Console](https://console.cloud.google.com/apis/credentials)
2. Edit your OAuth 2.0 Client ID
3. Under **Authorized redirect URIs**, add:
   ```
   https://your-backend.ondigitalocean.app/api/auth/callback
   ```
4. Click **Save**

### 5.3 Update app.yaml with Actual URLs

1. Update `app.yaml`:
   - Replace `your-backend.ondigitalocean.app` with your actual backend URL
   - Replace `your-frontend.ondigitalocean.app` with your actual frontend URL

2. Update environment variables in App Platform console:
   - `GOOGLE_REDIRECT_URI`: `https://your-backend.ondigitalocean.app/api/auth/callback`
   - `FRONTEND_URL`: `https://your-frontend.ondigitalocean.app`
   - `VITE_API_URL`: `https://your-backend.ondigitalocean.app`

3. Redeploy or update via console:
   ```bash
   # If using doctl
   doctl apps update $APP_ID --spec app.yaml
   ```

## Step 6: Verify Deployment

1. **Check Health Endpoints:**
   - Backend: `https://your-backend.ondigitalocean.app/health`
   - Should return: `{"status": "healthy"}`

2. **Check API Documentation:**
   - Visit: `https://your-backend.ondigitalocean.app/docs`
   - You should see FastAPI interactive documentation

3. **Test Frontend:**
   - Visit your frontend URL
   - You should see the HouseholdManager interface

4. **Test Google Calendar Integration:**
   - Click "Add Google Calendar"
   - Complete OAuth flow
   - Verify calendar appears in the list
   - Check that events are displayed

## Troubleshooting

### Backend Not Starting

1. **Check Logs:**
   ```bash
   doctl apps logs $APP_ID --component backend --type run
   ```
   Or view in App Platform console under **Runtime Logs**

2. **Common Issues:**
   - Missing environment variables → Check Settings > Environment Variables
   - Database connection error → Verify `DATABASE_URL` is set correctly
   - Port mismatch → Ensure app uses port 8080 (App Platform requirement)

### Frontend Not Loading

1. **Check Build Logs:**
   ```bash
   doctl apps logs $APP_ID --component frontend --type build
   ```

2. **Common Issues:**
   - Build errors → Check `package.json` dependencies
   - API URL not set → Verify `VITE_API_URL` is set at BUILD_TIME
   - CORS errors → Check `FRONTEND_URL` in backend environment variables

### Google OAuth Not Working

1. **Verify Redirect URI:**
   - Must exactly match: `https://your-backend.ondigitalocean.app/api/auth/callback`
   - Check Google Cloud Console credentials

2. **Check Environment Variables:**
   - Verify `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` are set
   - Check they're marked as encrypted secrets

3. **Check Logs:**
   - Look for OAuth errors in backend logs
   - Check browser console for frontend errors

### Database Connection Issues

1. **If using Managed Database:**
   - Verify database is running in App Platform console
   - Check firewall rules allow app connection
   - Verify `DATABASE_URL` is automatically set

2. **If using External Database:**
   - Format: `postgresql://user:password@host:port/dbname?sslmode=require`
   - Verify SSL is enabled
   - Check network connectivity

## Updating Your Application

### Automatic Updates

If `deploy_on_push: true` is set in `app.yaml`, pushing to your main branch will automatically trigger a new deployment.

### Manual Updates

```bash
# Update app spec
doctl apps update $APP_ID --spec app.yaml

# Or update via web console
```

## Cost Estimation

**Basic Setup (Development):**
- Backend: Basic-XXS ($5/month)
- Frontend: Basic-XXS ($5/month)
- Database: db-s-dev-database ($15/month) - Optional
- **Total: ~$10-25/month**

**Production Setup:**
- Backend: Basic-S or higher ($12+/month)
- Frontend: Basic-S or higher ($12+/month)
- Database: Production tier ($15+/month)
- **Total: ~$40+/month**

## Security Checklist

- ✅ All secrets marked as encrypted in App Platform
- ✅ `.env` file in `.gitignore` (never committed)
- ✅ Google OAuth redirect URI matches exactly
- ✅ Database uses SSL connections
- ✅ CORS configured correctly
- ✅ Secret key is strong and unique
- ✅ Regular secret rotation planned

## Next Steps

1. Set up monitoring and alerts
2. Configure custom domain (optional)
3. Set up CI/CD pipeline
4. Enable database backups
5. Set up log aggregation
6. Configure rate limiting

## Support

- DigitalOcean Docs: https://docs.digitalocean.com/products/app-platform/
- App Platform Status: https://status.digitalocean.com/
- Community: https://www.digitalocean.com/community
