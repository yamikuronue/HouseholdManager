"""Event retrieval routes: aggregate events from all visible Google calendars."""

from datetime import datetime, timedelta, timezone

import httpx
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session, joinedload

from src.db.session import get_db
from src.models.database import Calendar, Member

from src.api.routes.auth import get_current_user
from src.models.database import User

router = APIRouter(prefix="/api/events", tags=["events"])


def _parse_google_event_time(start_or_end: dict) -> str | None:
    """Return ISO start/end string for FullCalendar. Prefer dateTime; fallback to date (all-day)."""
    if not start_or_end:
        return None
    if "dateTime" in start_or_end:
        return start_or_end["dateTime"]
    if "date" in start_or_end:
        return start_or_end["date"]
    return None


@router.get("")
async def get_events(
    start_date: datetime | None = Query(None, description="Start of range (ISO)"),
    end_date: datetime | None = Query(None, description="End of range (ISO)"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Get aggregated events from all calendars visible to the current user."""
    now = datetime.now(timezone.utc)
    if not start_date:
        start_date = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    if not end_date:
        end_date = start_date + timedelta(days=60)

    # Households the current user belongs to
    my_memberships = (
        db.query(Member.household_id).filter(Member.user_id == current_user.id).all()
    )
    user_household_ids = [m[0] for m in my_memberships]

    if not user_household_ids:
        return {"events": []}

    # Visible calendars in those households (with member and user for access_token)
    calendars = (
        db.query(Calendar)
        .join(Member, Calendar.member_id == Member.id)
        .filter(
            Member.household_id.in_(user_household_ids),
            Calendar.is_visible.is_(True),
        )
        .options(joinedload(Calendar.member).joinedload(Member.user))
        .all()
    )

    all_events = []
    time_min = start_date.isoformat().replace("+00:00", "Z")
    time_max = end_date.isoformat().replace("+00:00", "Z")

    async with httpx.AsyncClient() as client:
        for cal in calendars:
            user = cal.member.user
            if not user or not user.access_token:
                continue
            url = (
                f"https://www.googleapis.com/calendar/v3/calendars/{cal.google_calendar_id}/events"
            )
            params = {
                "timeMin": time_min,
                "timeMax": time_max,
                "singleEvents": "true",
                "orderBy": "startTime",
            }
            resp = await client.get(
                url,
                headers={"Authorization": f"Bearer {user.access_token}"},
                params=params,
            )
            if resp.status_code != 200:
                continue
            data = resp.json()
            for item in data.get("items") or []:
                start_str = _parse_google_event_time(item.get("start"))
                end_str = _parse_google_event_time(item.get("end"))
                if not start_str:
                    continue
                all_events.append({
                    "id": f"{cal.id}-{item.get('id', '')}",
                    "title": item.get("summary") or "(No title)",
                    "start": start_str,
                    "end": end_str or start_str,
                    "description": item.get("description"),
                    "location": item.get("location"),
                    "calendar_name": cal.name,
                    "color": cal.color,
                })

    return {"events": all_events}
