# Cheapest deploy: one component (frontend served from backend)

To pay for **only one** DigitalOcean app component, serve the React frontend from the FastAPI backend. No separate frontend service.

## Option A: Use the fullstack Dockerfile on App Platform

1. In DigitalOcean App Platform, create or edit your app.
2. Set the **Source** to use the Dockerfile:
   - **Source**: GitHub, this repo, branch `main`
   - **Resource Type**: **Dockerfile**
   - **Dockerfile Path**: `Dockerfile.fullstack`
3. Remove the separate **frontend** service if you had one (one component only).
4. Set **HTTP port** to `8080`.
5. Set env vars as usual (see [ENV_VARIABLES.md](ENV_VARIABLES.md)); use the **same** app URL for:
   - `GOOGLE_REDIRECT_URI`: `https://your-app.ondigitalocean.app/api/auth/callback`
   - `FRONTEND_URL`: `https://your-app.ondigitalocean.app`
6. Deploy.

The Dockerfile builds the frontend (with API on same origin), then runs the backend. FastAPI serves the built React app from `/` and the API from `/api`.

## Option B: Use app spec with Dockerfile

In your `app.yaml` you can define a single service that uses the Dockerfile:

```yaml
name: household-manager
region: nyc

services:
  - name: web
    github:
      repo: your-username/HouseholdManager
      branch: main
    dockerfile_path: Dockerfile.fullstack
    http_port: 8080
    instance_count: 1
    instance_size_slug: basic-xxs
    routes:
      - path: /
    health_check:
      http_path: /health
    envs:
      - key: DATABASE_URL
        scope: RUN_TIME
        type: SECRET
        value: ${DATABASE_URL}
      # ... other envs (GOOGLE_*, SECRET_KEY, FRONTEND_URL = same app URL)
```

Then remove the separate `frontend` service and the duplicate backend service.

## Cost

- **Before**: Backend (~$5) + Frontend (~$5) = **~$10/month** (plus DB if used).
- **After**: One app component (~$5) = **~$5/month** (plus DB if used).

## Other cheap options

- **Static Site**: If you later want the frontend as its own URL, you can use a DigitalOcean **Static Site** (often $0–3/month) that builds `frontend/` and set `VITE_API_URL` to your backend URL. You’d then have backend + static site instead of backend + app for frontend.
