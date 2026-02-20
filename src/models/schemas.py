"""Pydantic schemas for API requests and responses."""

from pydantic import BaseModel
from datetime import datetime
from typing import Optional, List


class CalendarBase(BaseModel):
    """Base calendar schema."""
    name: str
    google_calendar_id: str
    color: Optional[str] = None


class CalendarCreate(CalendarBase):
    """Schema for creating a calendar."""
    pass


class CalendarResponse(CalendarBase):
    """Schema for calendar response."""
    id: int
    is_active: bool
    created_at: datetime
    
    class Config:
        from_attributes = True


class EventBase(BaseModel):
    """Base event schema."""
    title: str
    start: datetime
    end: datetime
    description: Optional[str] = None
    location: Optional[str] = None


class EventResponse(EventBase):
    """Schema for event response."""
    id: str
    calendar_id: str
    calendar_name: str
    color: Optional[str] = None
    
    class Config:
        from_attributes = True
