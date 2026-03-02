"""Calendar CRUD routes."""

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from src.api.routes.auth import get_current_user
from src.db.session import get_db
from src.models.database import Calendar, Member
from src.models.database import User
from src.models.schemas import CalendarCreate, CalendarResponse, CalendarUpdate

router = APIRouter(prefix="/api/calendars", tags=["calendars"])


def _user_household_ids(db: Session, user_id: int) -> list[int]:
    rows = db.query(Member.household_id).filter(Member.user_id == user_id).all()
    return [r[0] for r in rows]


def _user_member_ids(db: Session, user_id: int) -> list[int]:
    rows = db.query(Member.id).filter(Member.user_id == user_id).all()
    return [r[0] for r in rows]


@router.get("", response_model=list[CalendarResponse])
def list_calendars(
    member_id: int | None = Query(None, description="Filter by member"),
    household_id: int | None = Query(None, description="All calendars for household"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """List calendars for households the current user is in."""
    hid_list = _user_household_ids(db, current_user.id)
    if not hid_list:
        return []
    q = db.query(Calendar).join(Member).filter(Member.household_id.in_(hid_list))
    if member_id is not None:
        my_mids = _user_member_ids(db, current_user.id)
        if member_id not in my_mids:
            return []
        q = q.filter(Calendar.member_id == member_id)
    if household_id is not None:
        if household_id not in hid_list:
            return []
        q = q.filter(Member.household_id == household_id)
    return q.all()


@router.post("", response_model=CalendarResponse, status_code=201)
def create_calendar(
    body: CalendarCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Add a calendar for the current user's member (only your own calendars)."""
    member = db.get(Member, body.member_id)
    if not member:
        raise HTTPException(status_code=404, detail="Member not found")
    if member.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="You can only add calendars for yourself")
    existing = (
        db.query(Calendar)
        .filter(
            Calendar.member_id == body.member_id,
            Calendar.google_calendar_id == body.google_calendar_id,
        )
        .first()
    )
    if existing:
        raise HTTPException(
            status_code=400,
            detail="This calendar is already added for this member",
        )
    cal = Calendar(
        member_id=body.member_id,
        google_calendar_id=body.google_calendar_id,
        name=body.name,
        color=body.color,
        is_visible=body.is_visible,
    )
    db.add(cal)
    db.commit()
    db.refresh(cal)
    return cal


@router.get("/{calendar_id}", response_model=CalendarResponse)
def get_calendar(
    calendar_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Get a calendar by id. Only allowed for calendars in the user's households."""
    cal = db.get(Calendar, calendar_id)
    if not cal:
        raise HTTPException(status_code=404, detail="Calendar not found")
    hid_list = _user_household_ids(db, current_user.id)
    member = db.get(Member, cal.member_id)
    if not member or member.household_id not in hid_list:
        raise HTTPException(status_code=404, detail="Calendar not found")
    return cal


@router.patch("/{calendar_id}", response_model=CalendarResponse)
def update_calendar(
    calendar_id: int,
    body: CalendarUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Update a calendar. Only the calendar owner (member's user) can update."""
    cal = db.get(Calendar, calendar_id)
    if not cal:
        raise HTTPException(status_code=404, detail="Calendar not found")
    member = db.get(Member, cal.member_id)
    if not member or member.user_id != current_user.id:
        raise HTTPException(status_code=404, detail="Calendar not found")
    if body.name is not None:
        cal.name = body.name
    if body.color is not None:
        cal.color = body.color
    if body.is_visible is not None:
        cal.is_visible = body.is_visible
    db.commit()
    db.refresh(cal)
    return cal


@router.delete("/{calendar_id}", status_code=204)
def delete_calendar(
    calendar_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Remove a calendar. Only the calendar owner can delete."""
    cal = db.get(Calendar, calendar_id)
    if not cal:
        raise HTTPException(status_code=404, detail="Calendar not found")
    member = db.get(Member, cal.member_id)
    if not member or member.user_id != current_user.id:
        raise HTTPException(status_code=404, detail="Calendar not found")
    db.delete(cal)
    db.commit()
    return None
