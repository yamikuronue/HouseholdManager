"""Member CRUD routes."""

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from src.db.session import get_db
from src.models.database import Member
from src.models.schemas import MemberCreate, MemberResponse, MemberUpdate

router = APIRouter(prefix="/api/members", tags=["members"])


@router.get("", response_model=list[MemberResponse])
def list_members(
    household_id: int | None = Query(None, description="Filter by household"),
    db: Session = Depends(get_db),
):
    """List members, optionally filtered by household_id."""
    q = db.query(Member)
    if household_id is not None:
        q = q.filter(Member.household_id == household_id)
    return q.all()


@router.post("", response_model=MemberResponse, status_code=201)
def create_member(body: MemberCreate, db: Session = Depends(get_db)):
    """Add a member (user) to a household."""
    existing = (
        db.query(Member)
        .filter(
            Member.user_id == body.user_id,
            Member.household_id == body.household_id,
        )
        .first()
    )
    if existing:
        raise HTTPException(
            status_code=400, detail="User is already a member of this household"
        )
    member = Member(
        user_id=body.user_id,
        household_id=body.household_id,
        role=body.role,
    )
    db.add(member)
    db.commit()
    db.refresh(member)
    return member


@router.get("/{member_id}", response_model=MemberResponse)
def get_member(member_id: int, db: Session = Depends(get_db)):
    """Get a member by id."""
    member = db.get(Member, member_id)
    if not member:
        raise HTTPException(status_code=404, detail="Member not found")
    return member


@router.patch("/{member_id}", response_model=MemberResponse)
def update_member(
    member_id: int, body: MemberUpdate, db: Session = Depends(get_db)
):
    """Update a member (e.g. role)."""
    member = db.get(Member, member_id)
    if not member:
        raise HTTPException(status_code=404, detail="Member not found")
    if body.role is not None:
        member.role = body.role
    db.commit()
    db.refresh(member)
    return member


@router.delete("/{member_id}", status_code=204)
def delete_member(member_id: int, db: Session = Depends(get_db)):
    """Remove a member from the household."""
    member = db.get(Member, member_id)
    if not member:
        raise HTTPException(status_code=404, detail="Member not found")
    db.delete(member)
    db.commit()
    return None
