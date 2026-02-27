"""Pydantic schemas for API requests and responses.

Aligns with docs/DATA_MODEL.md: User, Household, Member, Calendar.
"""

from datetime import datetime
from typing import Optional

from pydantic import BaseModel, ConfigDict


# ----- User -----


class UserBase(BaseModel):
    """User fields from Google OAuth."""

    email: str
    display_name: Optional[str] = None
    avatar_url: Optional[str] = None


class UserCreate(BaseModel):
    """Created after OAuth; server fills google_sub and tokens."""

    google_sub: str
    email: str
    display_name: Optional[str] = None
    avatar_url: Optional[str] = None


class UserResponse(UserBase):
    """User in API responses (no tokens)."""

    id: int
    google_sub: str
    model_config = ConfigDict(from_attributes=True)


# ----- Household -----


class HouseholdBase(BaseModel):
    name: str


class HouseholdCreate(HouseholdBase):
    pass


class HouseholdUpdate(BaseModel):
    name: Optional[str] = None
    meal_planner_weeks: Optional[int] = None


class HouseholdResponse(HouseholdBase):
    id: int
    meal_planner_weeks: Optional[int] = 2
    created_at: datetime
    model_config = ConfigDict(from_attributes=True)


# ----- Member -----


class MemberBase(BaseModel):
    role: Optional[str] = None
    event_color: Optional[str] = None


class MemberCreate(MemberBase):
    user_id: int
    household_id: int


class MemberUpdate(MemberBase):
    role: Optional[str] = None
    event_color: Optional[str] = None


class MemberResponse(MemberBase):
    id: int
    user_id: int
    household_id: int
    joined_at: datetime
    event_color: Optional[str] = None
    # Optional nested view
    user: Optional[UserResponse] = None
    household: Optional[HouseholdResponse] = None
    model_config = ConfigDict(from_attributes=True)


# ----- Calendar -----


class CalendarBase(BaseModel):
    name: str
    google_calendar_id: str
    color: Optional[str] = None
    is_visible: bool = True


class CalendarCreate(CalendarBase):
    member_id: int


class CalendarUpdate(BaseModel):
    name: Optional[str] = None
    color: Optional[str] = None
    is_visible: Optional[bool] = None


class CalendarResponse(CalendarBase):
    id: int
    member_id: int
    created_at: datetime
    model_config = ConfigDict(from_attributes=True)


# ----- Invitation -----


class InvitationCreate(BaseModel):
    household_id: int
    email: str
    invited_by_member_id: int


class InvitationResponse(BaseModel):
    id: int
    household_id: int
    email: str
    invited_by_member_id: int
    token: str
    status: str
    sent_at: datetime
    last_sent_at: datetime
    accepted_at: Optional[datetime] = None
    created_at: datetime
    model_config = ConfigDict(from_attributes=True)


class InvitationAccept(BaseModel):
    """Body when accepting an invite: token + user_id (the user joining)."""
    token: str
    user_id: int


# ----- MealSlot -----


class MealSlotCreate(BaseModel):
    household_id: int
    name: str
    position: Optional[int] = None


class MealSlotUpdate(BaseModel):
    name: Optional[str] = None
    position: Optional[int] = None


class MealSlotResponse(BaseModel):
    id: int
    household_id: int
    name: str
    position: int
    model_config = ConfigDict(from_attributes=True)


# ----- PlannedMeal -----


class PlannedMealCreate(BaseModel):
    household_id: int
    meal_date: str  # ISO date "YYYY-MM-DD"
    meal_slot_id: int
    member_id: int
    description: Optional[str] = None


class PlannedMealResponse(BaseModel):
    id: int
    household_id: int
    meal_date: str
    meal_slot_id: int
    member_id: int
    member_display_name: Optional[str] = None
    member_color: Optional[str] = None
    description: Optional[str] = None
    created_at: datetime
    model_config = ConfigDict(from_attributes=True)


# ----- TodoItem -----


class TodoItemCreate(BaseModel):
    household_id: int
    content: str
    is_section_header: bool = False
    position: Optional[int] = None


class TodoItemUpdate(BaseModel):
    content: Optional[str] = None
    is_section_header: Optional[bool] = None
    is_checked: Optional[bool] = None
    position: Optional[int] = None


class TodoItemResponse(BaseModel):
    id: int
    household_id: int
    content: str
    is_section_header: bool
    is_checked: bool
    checked_at: Optional[datetime] = None
    position: int
    created_at: datetime
    model_config = ConfigDict(from_attributes=True)


# ----- Event (API/aggregation only, not stored) -----


class EventBase(BaseModel):
    title: str
    start: datetime
    end: datetime
    description: Optional[str] = None
    location: Optional[str] = None


class EventResponse(EventBase):
    id: str
    calendar_id: str
    calendar_name: str
    color: Optional[str] = None
    model_config = ConfigDict(from_attributes=True)
