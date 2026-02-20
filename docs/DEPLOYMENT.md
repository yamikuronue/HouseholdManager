# Deployment Guide - DigitalOcean

This guide covers secure credential storage and deployment options for DigitalOcean.

## Secure Credential Storage Options

### Option 1: DigitalOcean App Platform (Recommended)

If you're using **DigitalOcean App Platform**, this is the easiest and most secure option:

#### Setting Environment Variables in App Platform

1. **Via Web Console:**
   - Go to your App Platform app settings
   - Navigate to "Settings" > "App-Level Environment Variables"
   - Click "Edit" and add your secrets:
     ```
     GOOGLE_CLIENT_ID=your-client-id
     GOOGLE_CLIENT_SECRET=your-client-secret
     GOOGLE_REDIRECT_URI=https://your-app.ondigitalocean.app/api/auth/callback
     SECRET_KEY=your-secret-key
     DATABASE_URL=your-database-url
     FRONTEND_URL=https://your-frontend.ondigitalocean.app
     ```
   - Mark sensitive variables as "Encrypted" (they'll be hidden in the UI)

2. **Via App Spec (YAML):**
   Create an `app.yaml` file:
   ```yaml
   name: household-manager
   services:
   - name: backend
     github:
       repo: your-username/HouseholdManager
       branch: main
     run_command: uvicorn src.api.main:app --host 0.0.0.0 --port 8080
     environment_slug: python
     instance_count: 1
     instance_size_slug: basic-xxs
     envs:
     - key: GOOGLE_CLIENT_ID
       scope: RUN_TIME
       type: SECRET
       value: ${GOOGLE_CLIENT_ID}
     - key: GOOGLE_CLIENT_SECRET
       scope: RUN_TIME
       type: SECRET
       value: ${GOOGLE_CLIENT_SECRET}
     - key: DATABASE_URL
       scope: RUN_TIME
       type: SECRET
       value: ${DATABASE_URL}
     - key: SECRET_KEY
       scope: RUN_TIME
       type: SECRET
       value: ${SECRET_KEY}
   ```

   Then set these values in the App Platform console under "App-Level Environment Variables"

#### Benefits:
- ✅ Encrypted at rest
- ✅ Never exposed in logs or build output
- ✅ Easy to update via console
- ✅ Version controlled via app spec
- ✅ Free for App Platform users

### Option 2: DigitalOcean Spaces (Encrypted File Storage)

For storing credential files or larger secrets:

1. **Create a Space:**
   ```bash
   doctl spaces create household-manager-secrets --region nyc3
   ```

2. **Upload encrypted credentials:**
   ```bash
   # Encrypt your .env file
   gpg --symmetric --cipher-algo AES256 .env
   
   # Upload to Spaces
   doctl spaces object put household-manager-secrets .env.gpg
   ```

3. **Download and decrypt at runtime:**
   - Use DigitalOcean Spaces API or `doctl` in your startup script
   - Decrypt the file before starting the application

**Note:** This is more complex and typically not needed for App Platform.

### Option 3: DigitalOcean Managed Database

For database credentials:

1. **Create a Managed PostgreSQL Database:**
   ```bash
   doctl databases create household-manager-db \
     --engine pg \
     --region nyc3 \
     --size db-s-dev-database
   ```

2. **Get Connection String:**
   ```bash
   doctl databases connection household-manager-db
   ```

3. **Set as Environment Variable:**
   - Use the connection string as `DATABASE_URL` in App Platform
   - Credentials are managed by DigitalOcean automatically

### Option 4: Local Encrypted Storage (Development Only)

For local development, use encrypted environment files:

1. **Install `sops` or use `gpg`:**
   ```bash
   # Using GPG
   gpg --symmetric --cipher-algo AES256 .env
   ```

2. **Decrypt before running:**
   ```bash
   gpg --decrypt .env.gpg > .env
   ```

**⚠️ Never commit `.env` files to git!**

## Recommended Setup for DigitalOcean App Platform

### Step 1: Prepare Your Application

Ensure your app reads from environment variables (already configured in `src/config.py`).

### Step 2: Create App Spec

Create `app.yaml` in your repository root:

```yaml
name: household-manager
region: nyc

services:
- name: backend
  github:
    repo: your-username/HouseholdManager
    branch: main
    deploy_on_push: true
  source_dir: /
  build_command: pip install -r requirements.txt
  run_command: uvicorn src.api.main:app --host 0.0.0.0 --port 8080
  environment_slug: python
  instance_count: 1
  instance_size_slug: basic-xxs
  http_port: 8080
  routes:
  - path: /
  envs:
  - key: DATABASE_URL
    scope: RUN_TIME
    type: SECRET
    value: ${DATABASE_URL}
  - key: GOOGLE_CLIENT_ID
    scope: RUN_TIME
    type: SECRET
    value: ${GOOGLE_CLIENT_ID}
  - key: GOOGLE_CLIENT_SECRET
    scope: RUN_TIME
    type: SECRET
    value: ${GOOGLE_CLIENT_SECRET}
  - key: GOOGLE_REDIRECT_URI
    scope: RUN_TIME
    value: https://your-backend.ondigitalocean.app/api/auth/callback
  - key: SECRET_KEY
    scope: RUN_TIME
    type: SECRET
    value: ${SECRET_KEY}
  - key: FRONTEND_URL
    scope: RUN_TIME
    value: https://your-frontend.ondigitalocean.app

- name: frontend
  github:
    repo: your-username/HouseholdManager
    branch: main
    deploy_on_push: true
  source_dir: /frontend
  build_command: npm install && npm run build
  run_command: npm run preview
  environment_slug: node-js
  instance_count: 1
  instance_size_slug: basic-xxs
  http_port: 3000
  routes:
  - path: /
  envs:
  - key: VITE_API_URL
    scope: RUN_TIME
    value: https://your-backend.ondigitalocean.app
```

### Step 3: Set Secrets in App Platform Console

1. Go to [DigitalOcean App Platform](https://cloud.digitalocean.com/apps)
2. Create a new app or edit existing app
3. Go to "Settings" > "App-Level Environment Variables"
4. Add each secret:
   - `GOOGLE_CLIENT_ID` (mark as encrypted)
   - `GOOGLE_CLIENT_SECRET` (mark as encrypted)
   - `DATABASE_URL` (mark as encrypted)
   - `SECRET_KEY` (mark as encrypted)

### Step 4: Deploy

```bash
# Push your code
git push origin main

# Or deploy via doctl
doctl apps create --spec app.yaml
```

## Security Best Practices

1. **Never commit secrets to git:**
   - ✅ `.env` is in `.gitignore`
   - ✅ Use environment variables in production
   - ✅ Use App Platform secrets for deployment

2. **Rotate secrets regularly:**
   - Update Google OAuth credentials periodically
   - Regenerate `SECRET_KEY` if compromised

3. **Use different credentials per environment:**
   - Development: Local `.env` file
   - Staging: App Platform environment variables
   - Production: App Platform secrets (encrypted)

4. **Limit access:**
   - Only grant access to necessary team members
   - Use DigitalOcean IAM for access control

5. **Monitor access:**
   - Review App Platform audit logs
   - Set up alerts for credential changes

## Alternative: Using DigitalOcean Functions (Serverless)

If you prefer serverless:

1. Store secrets in DigitalOcean Functions environment variables
2. Access via `process.env` in your function code
3. Secrets are encrypted automatically

## Troubleshooting

### Secrets not loading?
- Verify environment variable names match exactly
- Check App Platform logs for errors
- Ensure secrets are marked as "Encrypted" type

### Database connection issues?
- Verify `DATABASE_URL` format: `postgresql://user:pass@host:port/dbname`
- Check database firewall rules allow your app
- Verify database is running and accessible

### OAuth redirect errors?
- Ensure `GOOGLE_REDIRECT_URI` matches your production URL
- Update Google Cloud Console with production redirect URI
- Check that the URL uses HTTPS in production
