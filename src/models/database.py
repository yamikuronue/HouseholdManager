"""SQLAlchemy database models."""

from sqlalchemy import Column, Integer, String, Boolean, DateTime, Text
from sqlalchemy.ext.declarative import declarative_base
from datetime import datetime

Base = declarative_base()


class Calendar(Base):
    """Calendar model for storing calendar configurations."""
    __tablename__ = "calendars"
    
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    google_calendar_id = Column(String, nullable=False, unique=True)
    color = Column(String, nullable=True)
    is_active = Column(Boolean, default=True)
    refresh_token = Column(Text, nullable=True)  # Encrypted refresh token
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
