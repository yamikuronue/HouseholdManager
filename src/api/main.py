"""FastAPI application entry point."""

from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from src.config import settings
from src.api.routes import auth, calendars, events, households, invitations, members
from src.db.session import init_db, run_migrations


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


@app.get("/")
async def root():
    """Root endpoint."""
    return {"message": "HouseholdManager API"}


@app.get("/health")
async def health():
    """Health check endpoint."""
    return {"status": "healthy"}
