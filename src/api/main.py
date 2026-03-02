"""FastAPI application entry point."""

import logging
import os
import time
from pathlib import Path

from contextlib import asynccontextmanager
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse

from src.config import settings
from src.api.routes import auth, calendars, events, grocery_lists, households, invitations, meal_planner, members, todos
from src.db.session import init_db, run_migrations

logger = logging.getLogger(__name__)

# Rate limit /api/auth only: in-memory IP -> list of request timestamps
_AUTH_RATE_LIMIT_WINDOW = 60  # seconds
_AUTH_RATE_LIMIT_MAX = 20     # requests per window per IP
_auth_rate_store: dict[str, list[float]] = {}


# Directory for frontend static build (single-component deploy). Prefer /app/static in Docker.
def _static_dir() -> Path:
    for candidate in (
        Path("/app/static"),  # Fullstack Dockerfile copies here
        Path(__file__).resolve().parent.parent.parent / "static",
        Path(os.getcwd()) / "static",
    ):
        idx = candidate / "index.html"
        if idx.exists():
            return candidate
    return Path(__file__).resolve().parent.parent.parent / "static"


STATIC_DIR = _static_dir()


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Run on startup: apply migrations and create any missing tables."""
    if not os.getenv("TESTING"):
        run_migrations()  # Alembic upgrade head (no-op if no Alembic)
    init_db()  # SQLAlchemy create_all for any missing tables
    # Log static dir so we can confirm SPA is served in fullstack deploy
    _dir = STATIC_DIR
    _idx = _dir / "index.html"
    logger.info("Static dir: %s, exists=%s, index.html exists=%s", _dir, _dir.exists(), _idx.exists())
    yield


app = FastAPI(
    title="Lionfish API",
    description="API for managing and aggregating Google Calendars",
    version="1.0.0",
    lifespan=lifespan,
)

# Secure headers (run after CORS so responses get these)
@app.middleware("http")
async def add_secure_headers(request, call_next):
    response = await call_next(request)
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
    csp = "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self' data:; connect-src 'self' https://accounts.google.com https://oauth2.googleapis.com https://www.googleapis.com https://api.mailjet.com; frame-ancestors 'none';"
    response.headers["Content-Security-Policy"] = csp
    return response

# Rate limit /api/auth only
@app.middleware("http")
async def auth_rate_limit(request, call_next):
    path = request.scope.get("path", "")
    if not path.startswith("/api/auth"):
        return await call_next(request)
    client = request.client
    ip = client.host if client else "unknown"
    now = time.monotonic()
    if ip not in _auth_rate_store:
        _auth_rate_store[ip] = []
    times = _auth_rate_store[ip]
    times[:] = [t for t in times if now - t < _AUTH_RATE_LIMIT_WINDOW]
    if len(times) >= _AUTH_RATE_LIMIT_MAX:
        from fastapi.responses import JSONResponse
        return JSONResponse(status_code=429, content={"detail": "Too many requests. Try again later."})
    times.append(now)
    return await call_next(request)

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings.FRONTEND_URL, "http://localhost:3000", "http://localhost:8080"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(households.router)
app.include_router(members.router)
app.include_router(calendars.router)
app.include_router(invitations.router)
app.include_router(events.router)
app.include_router(todos.router)
app.include_router(meal_planner.router)
app.include_router(grocery_lists.router)
app.include_router(auth.router)


@app.get("/health")
async def health():
    """Health check endpoint."""
    return {"status": "healthy"}


# Serve built frontend when static/ has index.html (single-component deploy)
_has_static = STATIC_DIR.is_dir() and (STATIC_DIR / "index.html").exists()


@app.get("/api/debug/static")
async def debug_static():
    """Debug: whether static build is being served (for SPA routes like /login)."""
    return {
        "static_dir": str(STATIC_DIR),
        "static_dir_exists": STATIC_DIR.exists(),
        "index_html_exists": (STATIC_DIR / "index.html").exists(),
        "has_static": _has_static,
    }


if _has_static and (STATIC_DIR / "assets").is_dir():
    app.mount("/assets", StaticFiles(directory=STATIC_DIR / "assets"), name="assets")
elif _has_static:
    # index.html present but no assets/ (e.g. inlined assets); still serve SPA
    pass


@app.get("/{full_path:path}")
async def serve_spa(full_path: str):
    """Serve index.html for SPA routes when static build exists; else 404 for unknown paths."""
    if full_path.startswith("api/") or full_path == "api":
        raise HTTPException(status_code=404, detail="Not Found")
    if _has_static:
        safe_path = full_path.strip("/") or "."
        file_path = (STATIC_DIR / safe_path).resolve()
        try:
            file_path.resolve().relative_to(STATIC_DIR.resolve())
        except ValueError:
            raise HTTPException(status_code=404, detail="Not Found")
        if file_path.is_file():
            return FileResponse(file_path)
        return FileResponse(STATIC_DIR / "index.html")
    if full_path in ("", "/") or full_path == ".":
        return {"message": "Lionfish API"}
    raise HTTPException(status_code=404, detail="Not Found")


if not _has_static:
    @app.get("/")
    async def root():
        """Root endpoint when frontend is not bundled."""
        return {"message": "Lionfish API"}
