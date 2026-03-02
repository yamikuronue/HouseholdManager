"""Event retrieval and creation routes: aggregate from Google calendars; create via Google API."""

from datetime import datetime, timedelta, timezone

import httpx
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session, joinedload

from src.db.session import get_db
from src.models.database import Calendar, Member
from src.models.schemas import EventCreate

from src.api.routes.auth import get_current_user, refresh_google_token_if_needed
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
    q: str | None = Query(None, description="Search query (title, description, location)"),
    household_id: int | None = Query(None, description="Filter to this household's calendars"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Get aggregated events from calendars visible to the current user. Optional household_id limits to one household. Optional q searches via Google Calendar API."""
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
        return {"events": [], "skipped_calendars": []}

    if household_id is not None and household_id not in user_household_ids:
        return {"events": [], "skipped_calendars": []}

    household_ids = [household_id] if household_id is not None else user_household_ids

    # Visible calendars in the selected household(s) (with member and user for access_token)
    calendars = (
        db.query(Calendar)
        .join(Member, Calendar.member_id == Member.id)
        .filter(
            Member.household_id.in_(household_ids),
            Calendar.is_visible.is_(True),
        )
        .options(joinedload(Calendar.member).joinedload(Member.user))
        .all()
    )

    all_events = []
    skipped_calendars = []  # { "calendar_name", "owner" } when we can't load a calendar
    time_min = start_date.isoformat().replace("+00:00", "Z")
    time_max = end_date.isoformat().replace("+00:00", "Z")

    # Refresh expired/missing Google tokens for calendar owners so we can fetch all households' events
    for cal in calendars:
        if cal.member and cal.member.user:
            refresh_google_token_if_needed(cal.member.user, db)

    def _owner_label(cal) -> str:
        if cal.member and cal.member.user:
            u = cal.member.user
            return u.display_name or u.email or "Unknown"
        return "Unknown"

    async with httpx.AsyncClient() as client:
        for cal in calendars:
            user = cal.member.user
            owner_is_current = user and user.id == current_user.id
            if not user or not user.access_token:
                skipped_calendars.append({
                    "calendar_name": cal.name,
                    "owner": _owner_label(cal),
                    "owner_is_current_user": owner_is_current,
                })
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
            if q and q.strip():
                params["q"] = q.strip()
            resp = await client.get(
                url,
                headers={"Authorization": f"Bearer {user.access_token}"},
                params=params,
            )
            if resp.status_code != 200:
                skipped_calendars.append({
                    "calendar_name": cal.name,
                    "owner": _owner_label(cal),
                    "owner_is_current_user": owner_is_current,
                })
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
                    "color": (cal.member.event_color if cal.member else None) or cal.color,
                    "html_link": item.get("htmlLink"),
                })

    return {"events": all_events, "skipped_calendars": skipped_calendars}


@router.get("/writable-calendars")
def get_writable_calendars(
    household_id: int | None = Query(None, description="Filter to calendars in this household"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """List calendars the current user can add events to (calendars they own). Optional household_id limits to one household."""
    q = (
        db.query(Calendar)
        .join(Member, Calendar.member_id == Member.id)
        .filter(Member.user_id == current_user.id)
    )
    if household_id is not None:
        q = q.filter(Member.household_id == household_id)
    calendars = q.order_by(Calendar.name).all()
    return [
        {"id": cal.id, "name": cal.name}
        for cal in calendars
    ]


@router.post("")
async def create_event(
    body: EventCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Create an event on a Google calendar. Only the calendar owner (member's user) can create."""
    cal = (
        db.query(Calendar)
        .options(joinedload(Calendar.member).joinedload(Member.user))
        .filter(Calendar.id == body.calendar_id)
        .first()
    )
    if not cal:
        raise HTTPException(status_code=404, detail="Calendar not found")
    if cal.member.user_id != current_user.id:
        raise HTTPException(
            status_code=403,
            detail="You can only add events to calendars you own. Select one of your calendars.",
        )
    user = cal.member.user
    if not user or not user.access_token:
        raise HTTPException(
            status_code=400,
            detail="No Google access token. Sign out and sign in again to grant calendar access.",
        )

    # Google Calendar API expects RFC3339 dateTime and optional timeZone
    start_dt = body.start if body.start.tzinfo else body.start.replace(tzinfo=timezone.utc)
    end_dt = body.end if body.end.tzinfo else body.end.replace(tzinfo=timezone.utc)
    payload = {
        "summary": body.title,
        "description": body.description or "",
        "location": body.location or "",
        "start": {"dateTime": start_dt.isoformat().replace("+00:00", "Z"), "timeZone": "UTC"},
        "end": {"dateTime": end_dt.isoformat().replace("+00:00", "Z"), "timeZone": "UTC"},
    }

    url = f"https://www.googleapis.com/calendar/v3/calendars/{cal.google_calendar_id}/events"
    async with httpx.AsyncClient() as client:
        resp = await client.post(
            url,
            headers={"Authorization": f"Bearer {user.access_token}"},
            json=payload,
        )
    if resp.status_code == 401:
        raise HTTPException(
            status_code=401,
            detail="Google token expired or invalid. Sign out and sign in again.",
        )
    if resp.status_code not in (200, 201):
        raise HTTPException(
            status_code=502,
            detail=f"Google Calendar API error: {resp.status_code}",
        )
    data = resp.json()
    start_str = data.get("start", {}).get("dateTime") or data.get("start", {}).get("date")
    end_str = data.get("end", {}).get("dateTime") or data.get("end", {}).get("date") or start_str
    return {
        "id": f"{cal.id}-{data.get('id', '')}",
        "title": data.get("summary") or body.title,
        "start": start_str,
        "end": end_str,
        "description": data.get("description"),
        "location": data.get("location"),
        "calendar_name": cal.name,
        "color": (cal.member.event_color if cal.member else None) or cal.color,
        "html_link": data.get("htmlLink"),
    }
