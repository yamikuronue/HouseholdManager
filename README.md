# HouseholdManager
A household manager tool custom built for my household. Aggregates multiple Google Calendars into a unified view.

## Features

- 🔗 Connect multiple Google Calendars
- 📅 Unified calendar view with all events
- 🎨 Color-coded calendars
- 🐳 Fully containerized application
- 🔐 Secure OAuth2 authentication

## Architecture

This application consists of:
- **Backend**: FastAPI REST API (Python)
- **Frontend**: React application with FullCalendar widget
- **Database**: SQLite (can be upgraded to PostgreSQL)
- **Integration**: Google Calendar API

See [ARCHITECTURE.md](ARCHITECTURE.md) for detailed architecture documentation.

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

## Docker Deployment

### Using Docker Compose (Recommended)

1. Ensure your `.env` file is configured (see Setup step 2)

2. Build and run all services:
```bash
docker-compose up --build
```

This will start both backend and frontend services.

### Using Docker individually

**Backend:**
```bash
docker build -t householdmanager-backend .
docker run -p 8000:8000 --env-file .env householdmanager-backend
```

**Frontend:**
```bash
cd frontend
docker build -t householdmanager-frontend .
docker run -p 3000:3000 householdmanager-frontend
```

## Project Structure

```
HouseholdManager/
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

### Database Migrations
Currently using SQLAlchemy with automatic table creation. For production, consider using Alembic for migrations.

## Deployment

### DigitalOcean App Platform

Complete deployment guide available in [SETUP_DIGITALOCEAN.md](SETUP_DIGITALOCEAN.md)

**Quick Start:**
1. Update `app.yaml` with your GitHub repository
2. Set secrets in DigitalOcean App Platform console (see [ENV_VARIABLES.md](ENV_VARIABLES.md))
3. Deploy via `doctl apps create --spec app.yaml` or web console
4. Update Google Cloud Console with production redirect URI

**Required Environment Variables:**
- `GOOGLE_CLIENT_ID` (encrypted secret)
- `GOOGLE_CLIENT_SECRET` (encrypted secret)
- `SECRET_KEY` (encrypted secret)
- `DATABASE_URL` (encrypted secret, or use managed database)

See [ENV_VARIABLES.md](ENV_VARIABLES.md) for complete reference.

### Credential Storage

**For DigitalOcean App Platform (Recommended):**
- Use App Platform's built-in encrypted environment variables
- Set secrets in Settings > App-Level Environment Variables
- Mark sensitive values as "Encrypted" type
- Never commit `.env` files to git

See [DEPLOYMENT.md](DEPLOYMENT.md) for detailed instructions.

## Next Steps

1. Implement Google OAuth flow in `src/api/routes/auth.py`
2. Complete Google Calendar API integration in `src/services/google_calendar.py`
3. Implement calendar aggregation logic
4. Add error handling and loading states
5. Enhance UI/UX

## License

MIT License - see LICENSE file for details
