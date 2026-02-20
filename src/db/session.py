"""Database session management."""

import os
from pathlib import Path

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, Session

from src.models.database import Base

# Database URL - defaults to SQLite
DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./household_manager.db")

# Create engine
engine = create_engine(
    DATABASE_URL,
    connect_args={"check_same_thread": False} if "sqlite" in DATABASE_URL else {}
)

# Create session factory
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


def run_migrations() -> None:
    """Run Alembic migrations (upgrade to head). No-op if Alembic not configured."""
    try:
        from alembic import command
        from alembic.config import Config
        root = Path(__file__).resolve().parent.parent.parent  # project root
        alembic_ini = root / "alembic.ini"
        if not alembic_ini.exists():
            return
        config = Config(str(alembic_ini))
        command.upgrade(config, "head")
    except Exception:
        pass  # Alembic not installed or no migrations: rely on init_db()


def init_db() -> None:
    """Create any missing tables (SQLAlchemy create_all)."""
    Base.metadata.create_all(bind=engine)


def get_db() -> Session:
    """Get database session."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
