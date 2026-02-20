"""Database session management."""

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, Session
from src.models.database import Base
import os

# Database URL - defaults to SQLite
DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./household_manager.db")

# Create engine
engine = create_engine(
    DATABASE_URL,
    connect_args={"check_same_thread": False} if "sqlite" in DATABASE_URL else {}
)

# Create session factory
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


def init_db():
    """Initialize database tables."""
    Base.metadata.create_all(bind=engine)


def get_db() -> Session:
    """Get database session."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
