# How the Python Code Works

This document walks through the backend from startup to handling a request.

---

## 1. Entry point and server

**`src/main.py`** is what you run (e.g. `python -m src.main`):

1. Imports **settings** from `src.config` and **init_db** from `src.db.session`.
2. Calls **`init_db()`** so all SQLAlchemy tables exist (create_all).
3. Starts **Uvicorn** with `src.api.main:app` — the FastAPI app object lives in **`src.api.main`**.

So: **main.py** → config + DB init → **api/main.py** (FastAPI app).

---

## 2. Configuration

**`src/config.py`** defines a **Settings** class that reads from the environment:

- Optionally loads a **`.env`** file (via `python-dotenv`) for local dev.
- Reads **env vars** such as:
  - **Google OAuth**: `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REDIRECT_URI`
  - **Database**: `DATABASE_URL` (defaults to SQLite)
  - **API**: `API_HOST`, `API_PORT`
  - **Security**: `SECRET_KEY`, `ENCRYPTION_KEY`, `ENCRYPTION_KEY_PREVIOUS`
  - **Frontend**: `FRONTEND_URL`
  - **Email**: `MAILJET_*`, `MAIL_FROM`, etc.

A single **`settings`** instance is created at import time. In production, **`validate()`** is used to warn about missing required vars.

---

## 3. FastAPI app and startup

**`src/api/main.py`** builds the FastAPI app and wires everything:

### Lifespan (startup)

- **`lifespan(app)`** runs when the app starts:
  - Runs **Alembic migrations** (`run_migrations()`) if not in `TESTING` and `alembic.ini` exists.
  - Calls **`init_db()`** so any missing tables are created.

### Middleware (order matters: last added = outermost)

1. **Secure headers** — adds `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`, `Content-Security-Policy`.
2. **Auth rate limit** — only for paths under `/api/auth`: in-memory per-IP limit (e.g. 20 requests per 60 seconds), returns 429 when exceeded.
3. **CORS** — allows the frontend origin and credentials so the browser can send cookies.

### Routers (API modules)

Routers are included so all routes live under their prefixes:

- **households** → `/api/households`
- **members** → `/api/members`
- **calendars** → `/api/calendars`
- **invitations** → `/api/invitations`
- **events** → `/api/events`
- **todos** → `/api/todos`
- **meal_planner** → `/api/meal-slots`, `/api/planned-meals`
- **grocery_lists** → `/api/grocery-lists`, `/api/grocery-list-items`
- **auth** → `/api/auth`

### Static / SPA

- The app looks for a built frontend in **`/app/static`** (Docker) or **`static/`** in the project.
- If **`static/index.html`** exists, it serves **`/assets/*`** from `static/assets` and uses **`serve_spa`** to serve **`index.html`** for non-API paths (so the React app can handle routes like `/login`, `/dashboard`).
- **`/health`** returns `{"status": "healthy"}` for health checks.

---

## 4. Request flow and dependencies

When a request hits something like **`GET /api/households`**:

1. **Middleware** run in order (secure headers, auth rate limit, CORS).
2. FastAPI matches the path to a **router** (e.g. `households.router`) and the **route function** (e.g. `list_households`).
3. **Dependencies** are resolved before the route runs:
   - **`get_db()`** — opens a DB session, yields it, then closes it after the request.
   - **`get_current_user(...)`** — only on routes that declare it; reads the JWT from the **cookie** (preferred) or **`Authorization: Bearer`**, decodes it, loads the **User** from the DB, or raises **401**.
4. The **route function** runs with the injected `current_user` and `db` (and any body/query params). It returns a dict or Pydantic model, which FastAPI serializes to JSON.

So: **middleware → route match → dependencies (DB, auth) → route handler → JSON response**.

---

## 5. Auth in detail

**`src/api/routes/auth.py`** handles:

- **Google OAuth** with **state + PKCE** (no tokens in the URL).
- **Session** via **HttpOnly cookie** and optional **Bearer** for API clients.

Flow:

1. **`GET /api/auth/google`** — builds Google’s auth URL with `state` and `code_challenge`, sets **`oauth_state`** and **`oauth_verifier`** in cookies, redirects to Google.
2. User signs in at Google; Google redirects to **`/api/auth/callback?code=...&state=...`**.
3. **Callback** checks `state` against the cookie, exchanges `code` + `code_verifier` for tokens, fetches userinfo, creates or updates a **User** in the DB. Tokens are **encrypted at rest** if `ENCRYPTION_KEY` is set. Then redirects to the **frontend** with **`?code=<one-time-code>`** (no JWT in URL).
4. Frontend calls **`POST /api/auth/exchange`** with **`{ "code": "..." }`**. Backend looks up the one-time code, issues a **JWT**, sets it in an **HttpOnly cookie** (`token`), returns 204.
5. **`GET /api/auth/me`** — reads JWT from cookie (or Bearer), returns current user info for the frontend.
6. **`get_current_user`** (dependency) uses the same cookie/Bearer logic so protected routes get the **User** or 401.

**Token encryption** (`src/services/token_encryption.py`): refresh and access tokens can be encrypted with Fernet; **`ENCRYPTION_KEY_PREVIOUS`** supports key rotation (decrypt with current or previous key, encrypt with current only).

---

## 6. Database and models

**`src/db/session.py`**:

- Builds a **SQLAlchemy engine** from `DATABASE_URL`.
- **`SessionLocal`** is a session factory (one session per request via **`get_db()`**).
- **`run_migrations()`** runs Alembic `upgrade head` when the app starts (if configured).
- **`init_db()`** calls **`Base.metadata.create_all(bind=engine)`** so all defined tables exist.

**`src/models/database.py`** defines SQLAlchemy models, e.g.:

- **User** — Google identity, email, display name, encrypted refresh/access tokens, token expiry.
- **Household** — name, meal_planner_weeks, timestamps.
- **Member** — links User to Household (role, event_color, etc.).
- **Calendar** — per-member link to a Google calendar; **Household** has many members, each can have calendars.
- **Invitation**, **TodoItem**, **MealSlot**, **PlannedMeal**, **GroceryList**, **GroceryListItem** — other domain entities.

Relationships (e.g. `Household.members`, `User.memberships`) are declared so ORM queries can load linked rows. **Pydantic schemas** in **`src/models/schemas.py`** define request/response shapes (e.g. `HouseholdCreate`, `HouseholdResponse`).

---

## 7. Typical route pattern

Example from **`src/api/routes/households.py`**:

```python
@router.get("", response_model=list[HouseholdResponse])
def list_households(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    hid_list = _user_household_ids(db, current_user.id)
    if not hid_list:
        return []
    return db.query(Household).filter(Household.id.in_(hid_list)).all()
```

- **`Depends(get_current_user)`** runs first and injects the logged-in **User** (or 401).
- **`Depends(get_db)`** injects the request-scoped **Session**.
- The handler uses **current_user** and **db** to query only data the user is allowed to see (e.g. households they’re a member of) and returns a list of **Household**; FastAPI serializes via **HouseholdResponse**.

Other routes (members, calendars, events, todos, meal planner, grocery lists, invitations) follow the same pattern: **auth dependency + DB + business logic + schema response**.

---

## 8. Services

Business logic that doesn’t belong in route handlers lives in **`src/services/`**:

- **`token_encryption.py`** — encrypt/decrypt tokens at rest (Fernet), with optional previous key for rotation.
- **`google_calendar.py`** — calls Google Calendar API (list calendars, list events) using the decrypted access token.
- **`calendar_aggregation.py`** — aggregates events from multiple calendars (used by the events API).
- **`email.py`** — sends invite emails via Mailjet (optional; invite links still work if email is not configured).

Routes import these and call them (e.g. auth uses **token_encryption**, events use **google_calendar** and **calendar_aggregation**).

---

## 9. Summary diagram

```
src/main.py
    → config.settings, db.init_db()
    → uvicorn.run("src.api.main:app")

src/api/main.py (FastAPI app)
    → lifespan: run_migrations(), init_db()
    → middleware: secure headers, auth rate limit, CORS
    → include_router(...) for households, members, auth, events, ...
    → /health, serve_spa for frontend

Request: GET /api/households
    → middleware
    → get_db() → Session
    → get_current_user() → User (cookie or Bearer)
    → list_households(current_user, db) → query Household, return list
    → JSON response
```

That’s the full path from **main.py** and config, through the FastAPI app and middleware, to auth and DB dependencies, and finally to route handlers and services.
