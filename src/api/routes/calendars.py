"""Calendar CRUD routes."""

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from src.db.session import get_db
from src.models.database import Calendar, Member
from src.models.schemas import CalendarCreate, CalendarResponse, CalendarUpdate

router = APIRouter(prefix="/api/calendars", tags=["calendars"])


@router.get("", response_model=list[CalendarResponse])
def list_calendars(
    member_id: int | None = Query(None, description="Filter by member"),
    household_id: int | None = Query(None, description="All calendars for household"),
    db: Session = Depends(get_db),
):
    """List calendars, optionally by member_id or by household_id."""
    q = db.query(Calendar)
    if member_id is not None:
        q = q.filter(Calendar.member_id == member_id)
    if household_id is not None:
        q = q.join(Member).filter(Member.household_id == household_id)
    return q.all()


@router.post("", response_model=CalendarResponse, status_code=201)
def create_calendar(body: CalendarCreate, db: Session = Depends(get_db)):
    """Add a calendar for a member."""
    member = db.get(Member, body.member_id)
    if not member:
        raise HTTPException(status_code=404, detail="Member not found")
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
def get_calendar(calendar_id: int, db: Session = Depends(get_db)):
    """Get a calendar by id."""
    cal = db.get(Calendar, calendar_id)
    if not cal:
        raise HTTPException(status_code=404, detail="Calendar not found")
    return cal


@router.patch("/{calendar_id}", response_model=CalendarResponse)
def update_calendar(
    calendar_id: int, body: CalendarUpdate, db: Session = Depends(get_db)
):
    """Update a calendar (name, color, visibility)."""
    cal = db.get(Calendar, calendar_id)
    if not cal:
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
def delete_calendar(calendar_id: int, db: Session = Depends(get_db)):
    """Remove a calendar."""
    cal = db.get(Calendar, calendar_id)
    if not cal:
        raise HTTPException(status_code=404, detail="Calendar not found")
    db.delete(cal)
    db.commit()
    return None
