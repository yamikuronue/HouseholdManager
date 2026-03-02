"""Invitation routes: send, list, resend, accept."""

import logging
import secrets
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from src.api.routes.auth import get_current_user
from src.config import settings
from src.db.session import get_db
from src.models.database import Household, Invitation, Member
from src.models.database import User
from src.models.schemas import (
    InvitationAccept,
    InvitationCreate,
    InvitationResponse,
    InvitationSendResponse,
)
from src.services.email import send_invitation_email

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/invitations", tags=["invitations"])


def _generate_token() -> str:
    return secrets.token_urlsafe(32)


def _user_household_ids(db: Session, user_id: int) -> list[int]:
    rows = db.query(Member.household_id).filter(Member.user_id == user_id).all()
    return [r[0] for r in rows]


@router.get("", response_model=list[InvitationResponse])
def list_invitations(
    household_id: int | None = Query(None, description="Filter by household"),
    status: str | None = Query(None, description="pending | accepted | expired"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """List invitations for households the current user is in."""
    hid_list = _user_household_ids(db, current_user.id)
    if not hid_list:
        return []
    q = db.query(Invitation).filter(Invitation.household_id.in_(hid_list))
    if household_id is not None:
        if household_id not in hid_list:
            return []
        q = q.filter(Invitation.household_id == household_id)
    if status is not None:
        q = q.filter(Invitation.status == status)
    return q.all()


def _send_invite_email_for(inv: Invitation) -> bool | None:
    """Send invitation email if Mailjet is configured. Returns True if sent, False on error, None if not configured."""
    base = settings.frontend_base_url.rstrip("/")
    accept_url = f"{base}/invite/accept?token={inv.token}"
    household_name = inv.household.name if inv.household else "a household"
    inviter_name = None
    if inv.invited_by and inv.invited_by.user:
        inviter_name = inv.invited_by.user.display_name or inv.invited_by.user.email
    ok = send_invitation_email(
        to_email=inv.email,
        household_name=household_name,
        inviter_name=inviter_name,
        accept_url=accept_url,
    )
    if ok is False:
        logger.warning("Invitation email could not be sent to %s (invite link still created)", inv.email)
    return ok  # True, False, or None


@router.post("", response_model=InvitationSendResponse, status_code=201)
def create_invitation(
    body: InvitationCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Send an invitation to join a household. Caller must be the inviter (member of that household)."""
    household = db.get(Household, body.household_id)
    if not household:
        raise HTTPException(status_code=404, detail="Household not found")
    inviter = db.get(Member, body.invited_by_member_id)
    if not inviter or inviter.household_id != body.household_id:
        raise HTTPException(
            status_code=400, detail="invited_by_member_id must be a member of the household"
        )
    if inviter.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="You can only send invites as yourself (your member in this household)")
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
        email_sent = _send_invite_email_for(existing)
        return InvitationSendResponse(invitation=InvitationResponse.model_validate(existing), email_sent=email_sent)
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
    email_sent = _send_invite_email_for(inv)
    return InvitationSendResponse(invitation=InvitationResponse.model_validate(inv), email_sent=email_sent)


@router.post("/resend/{invitation_id}", response_model=InvitationSendResponse)
def resend_invitation(
    invitation_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Resend an invitation. Only allowed for invitations in a household the current user is in."""
    inv = db.get(Invitation, invitation_id)
    if not inv:
        raise HTTPException(status_code=404, detail="Invitation not found")
    hid_list = _user_household_ids(db, current_user.id)
    if inv.household_id not in hid_list:
        raise HTTPException(status_code=404, detail="Invitation not found")
    if inv.status != "pending":
        raise HTTPException(
            status_code=400, detail="Can only resend a pending invitation"
        )
    inv.last_sent_at = datetime.utcnow()
    db.commit()
    db.refresh(inv)
    email_sent = _send_invite_email_for(inv)
    return InvitationSendResponse(invitation=InvitationResponse.model_validate(inv), email_sent=email_sent)


@router.delete("/{invitation_id}", status_code=204)
def delete_invitation(
    invitation_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Delete an invitation. Only allowed for invitations in a household the current user is in."""
    inv = db.get(Invitation, invitation_id)
    if not inv:
        raise HTTPException(status_code=404, detail="Invitation not found")
    hid_list = _user_household_ids(db, current_user.id)
    if inv.household_id not in hid_list:
        raise HTTPException(status_code=404, detail="Invitation not found")
    db.delete(inv)
    db.commit()
    return None


@router.get("/by-token/{token}", response_model=InvitationResponse)
def get_invitation_by_token(token: str, db: Session = Depends(get_db)):
    """Get invitation by token (e.g. for accept page)."""
    inv = db.query(Invitation).filter(Invitation.token == token).first()
    if not inv:
        raise HTTPException(status_code=404, detail="Invitation not found")
    return inv


@router.post("/accept", response_model=InvitationResponse)
def accept_invitation(
    body: InvitationAccept,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Accept an invitation for the current user. user_id in body must match current user.
    """
    if body.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="You can only accept an invitation for yourself")
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
