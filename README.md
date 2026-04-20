# Lionfish
A household manager tool custom built for my household. Aggregates multiple Google Calendars into a unified view.

## Features

- 🔗 Connect multiple Google Calendars
- 📅 Unified calendar view with all events
- 🎨 Color-coded calendars
- 🐳 Fully containerized application
- 🔐 Secure OAuth2 authentication

**Live:** [https://lionfish.cloud/](https://lionfish.cloud/) · [API docs](https://lionfish.cloud/docs) · See [docs/DEPLOYMENT_URLS.md](docs/DEPLOYMENT_URLS.md) for OAuth redirect URI. **Android WebView MVP:** [android/README.md](android/README.md) and [docs/ANDROID_WEBVIEW.md](docs/ANDROID_WEBVIEW.md).

## Architecture

This application consists of:
- **Backend**: FastAPI REST API (Python)
- **Frontend**: React application with FullCalendar widget
- **Database**: SQLite (can be upgraded to PostgreSQL)
- **Integration**: Google Calendar API

See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for detailed architecture documentation.

## Prerequisites

- Python 3.11 or higher
- Node.js 18+ (for frontend)
- Docker & Docker Compose (optional, for containerized deployment)
- Google Cloud Project with Calendar API enabled

## Setup

### 1. Google Cloud Setup

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select an existing one
3. Enable the Google Calendar API
4. Create OAuth 2.0 credentials:
   - Go to "APIs & Services" > "Credentials"
   - Click "Create Credentials" > "OAuth client ID"
   - Choose "Web application"
   - Add authorized redirect URI: `http://localhost:8000/api/auth/callback`
   - Save your Client ID and Client Secret

### 2. Environment Configuration

1. Copy the example environment file:
```bash
cp .env.example .env
```

2. Edit `.env` and add your Google OAuth credentials:
```env
GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your-client-secret
GOOGLE_REDIRECT_URI=http://localhost:8000/api/auth/callback
```

### 3. Backend Setup

1. Create and activate a virtual environment:
```bash
# Create virtual environment
python -m venv venv

# Activate virtual environment
# On Windows:
venv\Scripts\activate
# On macOS/Linux:
source venv/bin/activate
```

2. Install Python dependencies:
```bash
pip install -r requirements.txt
```

3. Initialize the database:
```bash
python -c "from src.db.session import init_db; init_db()"
```

4. Run the backend server:
```bash
python src/main.py
```

The API will be available at `http://localhost:8000`

**Local SQLite:** The default `DATABASE_URL` is `sqlite:///./household_manager.db`, so the database file is created in the project root (and is in `.gitignore`). For a separate DB only for tests, pytest uses `household_manager_test.db` by default (see [Testing](#running-tests)).

### 4. Frontend Setup

1. Navigate to the frontend directory:
```bash
cd frontend
```

2. Install dependencies:
```bash
npm install
```

3. Start the development server:
```bash
npm run dev
```

The frontend will be available at `http://localhost:3000`

**Frontend features:** Login with Google (OAuth via backend), logout, create household (you are added as a member), send invites by email, accept invites via link (`/invite/accept?token=...`), and add calendars per household. The dashboard shows only households you belong to.

## Docker Deployment

### Using Docker Compose (recommended for local dev)

Runs the app with **SQLite** in a `./data` directory (persisted on your machine; `data/` is in `.gitignore`).

1. Optional: copy `.env.example` to `.env` and set any needed variables (e.g. Google OAuth for full flow).
2. Build and run:
```bash
docker-compose up --build
```

- **Backend:** http://localhost:8000  
- **Frontend:** http://localhost:3000  
- **SQLite file:** `./data/household_manager.db` (created on first run)

To start with a fresh database, remove the `data` folder and run `docker-compose up` again.

### Using Docker individually

**Backend:**
```bash
docker build -t lionfish-backend .
docker run -p 8000:8000 --env-file .env lionfish-backend
```

**Frontend:**
```bash
cd frontend
docker build -t lionfish-frontend .
docker run -p 3000:3000 lionfish-frontend
```

## Project Structure

```
Lionfish/
├── src/
│   ├── api/              # FastAPI routes and main app
│   │   ├── routes/       # API endpoints (calendars, events, auth)
│   │   └── main.py       # FastAPI application
│   ├── services/         # Business logic layer
│   │   ├── google_calendar.py
│   │   ├── calendar_aggregation.py
│   │   └── auth.py
│   ├── models/           # Data models
│   │   ├── database.py   # SQLAlchemy models
│   │   └── schemas.py    # Pydantic schemas
│   ├── db/               # Database configuration
│   ├── config.py         # Application settings
│   └── main.py           # Application entry point
├── frontend/
│   ├── src/
│   │   ├── components/   # React components
│   │   │   ├── CalendarWidget.jsx
│   │   │   └── CalendarList.jsx
│   │   ├── services/     # API client
│   │   └── App.jsx
│   └── package.json
├── test/                 # Test files
├── requirements.txt       # Python dependencies
├── Dockerfile            # Backend Docker configuration
├── docker-compose.yml    # Full stack Docker setup
├── docs/                 # Documentation (architecture, deployment, etc.)
├── .env.example          # Environment variables template
└── README.md
```

## API Endpoints

- `GET /` - API root
- `GET /health` - Health check
- `GET /api/calendars` - List all calendars
- `POST /api/calendars` - Add a calendar
- `DELETE /api/calendars/{id}` - Remove a calendar
- `GET /api/events` - Get aggregated events
- `GET /api/auth/google` - Initiate Google OAuth
- `GET /api/auth/callback` - OAuth callback handler

API documentation available at `http://localhost:8000/docs` when running.

## Development

### Running Tests
```bash
python -m pytest test/
```

### Database migrations
On every app startup the app runs **Alembic** (`alembic upgrade head`) and then **create_all** for any missing tables. So the database is updated automatically when the app connects (e.g. on DigitalOcean deploy).

To add a new migration after changing models:
```bash
alembic revision --autogenerate -m "describe change"
alembic upgrade head   # optional locally; production runs this on startup
```

## Deployment

### Cheapest on DigitalOcean (one component)

To run **frontend + backend as a single app** (~$5/mo): use the root **Dockerfile** (fullstack build) on App Platform and follow [docs/SINGLE-COMPONENT-DEPLOY.md](docs/SINGLE-COMPONENT-DEPLOY.md). The backend serves the built React app and the API from the same URL. Local backend-only image: `Dockerfile.backend` (used by docker-compose).

### DigitalOcean App Platform (two components)

Complete deployment guide available in [docs/SETUP_DIGITALOCEAN.md](docs/SETUP_DIGITALOCEAN.md)

**Quick Start:**
1. Update `app.yaml` with your GitHub repository
2. Set secrets in DigitalOcean App Platform console (see [docs/ENV_VARIABLES.md](docs/ENV_VARIABLES.md))
3. Deploy via `doctl apps create --spec app.yaml` or web console
4. Update Google Cloud Console with production redirect URI

**Required Environment Variables:**
- `GOOGLE_CLIENT_ID` (encrypted secret)
- `GOOGLE_CLIENT_SECRET` (encrypted secret)
- `SECRET_KEY` (encrypted secret)
- `DATABASE_URL` (encrypted secret, or use managed database)

See [docs/ENV_VARIABLES.md](docs/ENV_VARIABLES.md) for complete reference.

### Credential Storage

**For DigitalOcean App Platform (Recommended):**
- Use App Platform's built-in encrypted environment variables
- Set secrets in Settings > App-Level Environment Variables
- Mark sensitive values as "Encrypted" type
- Never commit `.env` files to git

See [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) for detailed instructions.

## Next Steps

1. Implement Google OAuth flow in `src/api/routes/auth.py`
2. Complete Google Calendar API integration in `src/services/google_calendar.py`
3. Implement calendar aggregation logic
4. Add error handling and loading states
5. Enhance UI/UX

## License

MIT License - see LICENSE file for details
