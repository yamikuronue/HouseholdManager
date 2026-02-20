"""Calendar management routes."""

from fastapi import APIRouter

router = APIRouter(prefix="/api/calendars", tags=["calendars"])


@router.get("")
async def list_calendars():
    """List all configured calendars."""
    # TODO: Implement calendar listing
    return {"calendars": []}


@router.post("")
async def add_calendar():
    """Add a new Google Calendar."""
    # TODO: Implement calendar addition
    return {"message": "Calendar added"}


@router.delete("/{calendar_id}")
async def remove_calendar(calendar_id: str):
    """Remove a calendar."""
    # TODO: Implement calendar removal
    return {"message": f"Calendar {calendar_id} removed"}
