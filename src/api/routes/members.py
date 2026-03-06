"""Member CRUD routes."""

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func
from sqlalchemy.orm import Session, joinedload

from src.api.routes.auth import get_current_user
from src.db.session import get_db
from src.models.database import Member, User
from src.models.schemas import (
    DEFAULT_MEMBER_EVENT_COLOR,
    MemberCreate,
    MemberResponse,
    MemberUpdate,
)

router = APIRouter(prefix="/api/members", tags=["members"])


def _user_household_ids(db: Session, user_id: int) -> list[int]:
    rows = db.query(Member.household_id).filter(Member.user_id == user_id).all()
    return [r[0] for r in rows]


@router.get("", response_model=list[MemberResponse])
def list_members(
    household_id: int | None = Query(None, description="Filter by household; omit to list members of all your households"),
    _: str | None = Query(None, include_in_schema=False),  # cache-busting; ignored
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """List members of households the current user is in. If household_id is omitted, returns members of all households the user belongs to."""
    hid_list = _user_household_ids(db, current_user.id)
    if household_id is not None:
        if household_id not in hid_list:
            raise HTTPException(status_code=403, detail="You are not a member of this household")
        return (
            db.query(Member)
            .options(joinedload(Member.user))
            .filter(Member.household_id == household_id)
            .all()
        )
    if not hid_list:
        return []
    return (
        db.query(Member)
        .options(joinedload(Member.user))
        .filter(Member.household_id.in_(hid_list))
        .all()
    )


@router.post("", response_model=MemberResponse, status_code=201)
def create_member(
    body: MemberCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Add the current user as a member of a household (e.g. after creating the household). Only self-add allowed."""
    if body.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="You can only add yourself as a member")
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
    count = db.query(func.count(Member.id)).filter(Member.household_id == body.household_id).scalar()
    role = body.role
    if count == 0:
        role = "owner"
    member = Member(
        user_id=body.user_id,
        household_id=body.household_id,
        role=role,
        event_color=body.event_color or DEFAULT_MEMBER_EVENT_COLOR,
    )
    db.add(member)
    db.commit()
    db.refresh(member)
    return member


@router.get("/{member_id}", response_model=MemberResponse)
def get_member(
    member_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Get a member by id. Only allowed if the member is in a household the current user is in."""
    member = db.get(Member, member_id)
    if not member:
        raise HTTPException(status_code=404, detail="Member not found")
    hid_list = _user_household_ids(db, current_user.id)
    if member.household_id not in hid_list:
        raise HTTPException(status_code=404, detail="Member not found")
    return member


@router.patch("/{member_id}", response_model=MemberResponse)
def update_member(
    member_id: int,
    body: MemberUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Update a member. Allowed if same household; only owners can change role."""
    member = db.get(Member, member_id)
    if not member:
        raise HTTPException(status_code=404, detail="Member not found")
    hid_list = _user_household_ids(db, current_user.id)
    if member.household_id not in hid_list:
        raise HTTPException(status_code=404, detail="Member not found")
    my_membership = (
        db.query(Member)
        .filter(
            Member.household_id == member.household_id,
            Member.user_id == current_user.id,
        )
        .first()
    )
    if body.role is not None and my_membership and my_membership.role != "owner":
        raise HTTPException(status_code=403, detail="Only the household owner can change roles")
    if body.role is not None:
        member.role = body.role
    if body.event_color is not None:
        member.event_color = body.event_color
    db.commit()
    db.refresh(member)
    return member


@router.delete("/{member_id}", status_code=204)
def delete_member(
    member_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Remove a member from the household. Only an owner/manager of that household can remove members."""
    member = db.get(Member, member_id)
    if not member:
        raise HTTPException(status_code=404, detail="Member not found")
    my_membership = (
        db.query(Member)
        .filter(
            Member.household_id == member.household_id,
            Member.user_id == current_user.id,
        )
        .first()
    )
    if not my_membership:
        raise HTTPException(status_code=403, detail="You are not in this household")
    if my_membership.role != "owner":
        raise HTTPException(
            status_code=403,
            detail="Only the household owner can remove members",
        )
    if member.role == "owner":
        raise HTTPException(
            status_code=400,
            detail="Cannot remove an owner. They must leave or be demoted first.",
        )
    db.delete(member)
    db.commit()
    return None
