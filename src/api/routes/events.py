"""Event retrieval routes."""

from fastapi import APIRouter
from datetime import datetime

router = APIRouter(prefix="/api/events", tags=["events"])


@router.get("")
async def get_events(
    start_date: datetime | None = None,
    end_date: datetime | None = None
):
    """Get aggregated events from all calendars."""
    # TODO: Implement event retrieval and aggregation
    return {"events": []}
