"""FastAPI application entry point."""

from pathlib import Path

from contextlib import asynccontextmanager
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse

from src.config import settings
from src.api.routes import auth, calendars, events, households, invitations, members
from src.db.session import init_db, run_migrations


# Directory for frontend static build when served from this app (single-component deploy)
STATIC_DIR = Path(__file__).resolve().parent.parent.parent / "static"


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Run on startup: apply migrations and create any missing tables."""
    run_migrations()  # Alembic upgrade head (no-op if no Alembic)
    init_db()         # SQLAlchemy create_all for any missing tables
    yield


app = FastAPI(
    title="HouseholdManager API",
    description="API for managing and aggregating Google Calendars",
    version="1.0.0",
    lifespan=lifespan,
)

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
app.include_router(auth.router)


@app.get("/health")
async def health():
    """Health check endpoint."""
    return {"status": "healthy"}


# Serve built frontend when static/ exists (single-component deploy)
if STATIC_DIR.is_dir() and (STATIC_DIR / "index.html").exists():
    app.mount("/assets", StaticFiles(directory=STATIC_DIR / "assets"), name="assets")

    @app.get("/{full_path:path}")
    async def serve_spa(full_path: str):
        """Serve index.html for non-API routes (SPA)."""
        if full_path.startswith("api/") or full_path == "api":
            raise HTTPException(status_code=404, detail="Not Found")
        file_path = STATIC_DIR / full_path
        if file_path.is_file():
            return FileResponse(file_path)
        return FileResponse(STATIC_DIR / "index.html")
else:
    @app.get("/")
    async def root():
        """Root endpoint when frontend is not bundled."""
        return {"message": "HouseholdManager API"}
