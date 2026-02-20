"""FastAPI application entry point."""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from src.config import settings
from src.api.routes import calendars, events, auth

app = FastAPI(
    title="HouseholdManager API",
    description="API for managing and aggregating Google Calendars",
    version="1.0.0"
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
app.include_router(calendars.router)
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
