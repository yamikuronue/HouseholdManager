# HouseholdManager Architecture

## Overview

HouseholdManager is a web application that aggregates multiple Google Calendars into a unified view. The application consists of a Python backend API and a frontend web interface.

## System Architecture

```
┌─────────────────┐
│   Frontend      │  React/HTML+JS
│   (Browser)     │  Calendar Widget
└────────┬────────┘
         │ HTTP/REST API
         │
┌────────▼────────┐
│   Backend API   │  FastAPI
│   (Python)      │
└────────┬────────┘
         │
    ┌────┴────┬──────────────┐
    │         │              │
┌───▼───┐ ┌──▼───┐    ┌─────▼─────┐
│ SQLite│ │Google│    │  Config   │
│  DB   │ │Calendar│   │  Files    │
│       │ │  API  │    │           │
└───────┘ └──────┘    └───────────┘
```

## Components

### Backend (Python/FastAPI)

#### 1. API Layer (`src/api/`)
- RESTful endpoints for calendar operations
- Authentication endpoints (OAuth2 flow)
- Calendar management endpoints
- Event retrieval endpoints

**Key Endpoints:**
- `GET /api/calendars` - List all configured calendars
- `POST /api/calendars` - Add a new Google Calendar
- `DELETE /api/calendars/{id}` - Remove a calendar
- `GET /api/events` - Get aggregated events from all calendars
- `GET /api/todos?household_id=` - List household to-do items (removes items checked 7+ days ago)
- `POST /api/todos` - Add a to-do item or section header
- `PATCH /api/todos/{id}` - Update item (content, checked state, section header)
- `DELETE /api/todos/{id}` - Remove a to-do item
- `GET /api/auth/google` - Initiate Google OAuth flow
- `GET /api/auth/callback` - Handle OAuth callback

#### 2. Services Layer (`src/services/`)
- **GoogleCalendarService**: Handles Google Calendar API interactions
- **CalendarAggregationService**: Merges events from multiple calendars
- **AuthService**: Manages OAuth2 authentication flow

#### 3. Models Layer (`src/models/`)
- Database models (SQLAlchemy)
- Pydantic schemas for API requests/responses
- Calendar and Event data models

#### 4. Database (`src/db/`)
- SQLite database (can be upgraded to PostgreSQL)
- Stores:
  - Calendar configurations
  - OAuth tokens (encrypted)
  - User preferences

### Frontend

#### Structure (`frontend/`)
- **React** (recommended) or **Vanilla JS**
- Calendar widget component
- Calendar management UI
- OAuth flow handling

**Key Components:**
- CalendarWidget: Main calendar display
- CalendarList: Manage connected calendars
- TodoList: Household to-do list (inline add, check off, delete; section headers)
- EventCard: Display individual events
- AuthButton: Google authentication

## Data Flow

1. **Authentication Flow:**
   ```
   User → Frontend → Backend → Google OAuth → Backend → Store Token → Frontend
   ```

2. **Event Retrieval Flow:**
   ```
   Frontend → Backend API → GoogleCalendarService → Google Calendar API
   → Aggregate Events → Return JSON → Frontend → Render Calendar Widget
   ```

3. **Calendar Management:**
   ```
   User → Frontend → Backend API → Database → Store Calendar Config
   ```

## Technology Stack

### Backend
- **FastAPI**: Modern, fast web framework
- **SQLAlchemy**: ORM for database operations
- **google-api-python-client**: Google Calendar API client
- **python-jose**: JWT token handling
- **python-multipart**: Form data handling
- **pydantic**: Data validation

### Frontend
- **React** (recommended) or **Vanilla JavaScript**
- **FullCalendar.js** or **react-big-calendar**: Calendar widget library
- **Axios**: HTTP client for API calls

### Database
- **SQLite**: Development (lightweight, file-based)
- **PostgreSQL**: Production (optional upgrade)

### Authentication
- **Google OAuth 2.0**: For Google Calendar access
- **JWT**: For session management (optional)

## Data Model

The data layout is documented in [DATA_MODEL.md](DATA_MODEL.md). Summary:

- **Household** – Top-level container (e.g. "Smith Family").
- **User** – One per Google account; holds OAuth identity and tokens.
- **Member** – Links a User to a Household; a user can be in multiple households.
- **Calendar** – A Google calendar added by a Member; visible to all members of that household.
- **TodoItem** – Shared to-do list item for a Household; section headers and regular items; checked-off items auto-removed after 7 days.

When a member adds a calendar, it is shown to every other member in the same household (no separate sharing table).

## Security Considerations

1. **OAuth Tokens**: Store encrypted refresh tokens
2. **API Security**: Rate limiting, CORS configuration
3. **Environment Variables**: Store sensitive configs in `.env`
4. **Token Refresh**: Automatic token refresh before expiration

## Project Structure

```
HouseholdManager/
├── src/
│   ├── api/              # FastAPI routes
│   │   ├── __init__.py
│   │   ├── routes/
│   │   │   ├── calendars.py
│   │   │   ├── events.py
│   │   │   ├── todos.py
│   │   │   └── auth.py
│   │   └── main.py       # FastAPI app
│   ├── services/         # Business logic
│   │   ├── __init__.py
│   │   ├── google_calendar.py
│   │   ├── calendar_aggregation.py
│   │   └── auth.py
│   ├── models/           # Data models
│   │   ├── __init__.py
│   │   ├── database.py   # SQLAlchemy models
│   │   └── schemas.py    # Pydantic schemas
│   ├── db/               # Database setup
│   │   ├── __init__.py
│   │   └── session.py
│   └── config.py         # Configuration
├── frontend/
│   ├── public/
│   ├── src/
│   │   ├── components/
│   │   │   ├── CalendarWidget.jsx
│   │   │   ├── CalendarList.jsx
│   │   │   ├── TodoList.jsx
│   │   │   └── EventCard.jsx
│   │   ├── services/
│   │   │   └── api.js
│   │   └── App.jsx
│   └── package.json
├── test/
│   ├── unit/
│   ├── integration/
│   └── fixtures/
├── requirements.txt
├── Dockerfile
├── docker-compose.yml    # For full stack
└── README.md
```

## Development Phases

### Phase 1: Backend Foundation
- Set up FastAPI application
- Database models and migrations
- Basic API structure

### Phase 2: Google Calendar Integration
- OAuth2 flow implementation
- Google Calendar API client
- Calendar listing and event retrieval

### Phase 3: Calendar Aggregation
- Merge events from multiple calendars
- Handle timezone conversions
- Event deduplication logic

### Phase 4: Frontend
- Calendar widget implementation
- Calendar management UI
- Event display

### Phase 5: Polish & Deploy
- Error handling
- Loading states
- Docker containerization
- Deployment configuration
