"""Invitation routes: send, list, resend, accept."""

import secrets
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from src.db.session import get_db
from src.models.database import Household, Invitation, Member
from src.models.schemas import InvitationAccept, InvitationCreate, InvitationResponse

router = APIRouter(prefix="/api/invitations", tags=["invitations"])


def _generate_token() -> str:
    return secrets.token_urlsafe(32)


@router.get("", response_model=list[InvitationResponse])
def list_invitations(
    household_id: int | None = Query(None, description="Filter by household"),
    status: str | None = Query(None, description="pending | accepted | expired"),
    db: Session = Depends(get_db),
):
    """List invitations, optionally filtered by household_id and status."""
    q = db.query(Invitation)
    if household_id is not None:
        q = q.filter(Invitation.household_id == household_id)
    if status is not None:
        q = q.filter(Invitation.status == status)
    return q.all()


@router.post("", response_model=InvitationResponse, status_code=201)
def create_invitation(body: InvitationCreate, db: Session = Depends(get_db)):
    """Send an invitation to join a household (by email). Records sent_at and last_sent_at."""
    household = db.get(Household, body.household_id)
    if not household:
        raise HTTPException(status_code=404, detail="Household not found")
    inviter = db.get(Member, body.invited_by_member_id)
    if not inviter or inviter.household_id != body.household_id:
        raise HTTPException(
            status_code=400, detail="invited_by_member_id must be a member of the household"
        )
    # Reuse pending invitation for same email + household
    existing = (
        db.query(Invitation)
        .filter(
            Invitation.household_id == body.household_id,
            Invitation.email == body.email.strip().lower(),
            Invitation.status == "pending",
        )
        .first()
    )
    now = datetime.utcnow()
    if existing:
        existing.last_sent_at = now
        db.commit()
        db.refresh(existing)
        return existing
    token = _generate_token()
    while db.query(Invitation).filter(Invitation.token == token).first():
        token = _generate_token()
    inv = Invitation(
        household_id=body.household_id,
        email=body.email.strip().lower(),
        invited_by_member_id=body.invited_by_member_id,
        token=token,
        status="pending",
        sent_at=now,
        last_sent_at=now,
    )
    db.add(inv)
    db.commit()
    db.refresh(inv)
    return inv


@router.post("/resend/{invitation_id}", response_model=InvitationResponse)
def resend_invitation(invitation_id: int, db: Session = Depends(get_db)):
    """Resend an invitation: update last_sent_at."""
    inv = db.get(Invitation, invitation_id)
    if not inv:
        raise HTTPException(status_code=404, detail="Invitation not found")
    if inv.status != "pending":
        raise HTTPException(
            status_code=400, detail="Can only resend a pending invitation"
        )
    inv.last_sent_at = datetime.utcnow()
    db.commit()
    db.refresh(inv)
    return inv


@router.get("/by-token/{token}", response_model=InvitationResponse)
def get_invitation_by_token(token: str, db: Session = Depends(get_db)):
    """Get invitation by token (e.g. for accept page)."""
    inv = db.query(Invitation).filter(Invitation.token == token).first()
    if not inv:
        raise HTTPException(status_code=404, detail="Invitation not found")
    return inv


@router.post("/accept", response_model=InvitationResponse)
def accept_invitation(body: InvitationAccept, db: Session = Depends(get_db)):
    """
    Accept an invitation: create Member (user_id + household_id) and mark invitation accepted.
    Call this when the invited user (user_id) accepts the invite (using the token from the link).
    """
    inv = db.query(Invitation).filter(Invitation.token == body.token).first()
    if not inv:
        raise HTTPException(status_code=404, detail="Invitation not found")
    if inv.status != "pending":
        raise HTTPException(
            status_code=400, detail="Invitation is not pending (already accepted or expired)"
        )
    existing = (
        db.query(Member)
        .filter(
            Member.user_id == body.user_id,
            Member.household_id == inv.household_id,
        )
        .first()
    )
    if existing:
        # Already a member; just mark invite accepted
        inv.status = "accepted"
        inv.accepted_at = datetime.utcnow()
        db.commit()
        db.refresh(inv)
        return inv
    member = Member(user_id=body.user_id, household_id=inv.household_id)
    db.add(member)
    inv.status = "accepted"
    inv.accepted_at = datetime.utcnow()
    db.commit()
    db.refresh(inv)
    return inv
