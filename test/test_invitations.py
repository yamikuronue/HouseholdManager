"""Tests for invitation visibility and actions for invite recipients."""

import uuid

import pytest
from fastapi.testclient import TestClient

from src.api.main import app
from src.api.routes.auth import create_access_token
from src.db.session import get_db
from src.models.database import Household, Invitation, Member, User


@pytest.fixture
def user(db):
    uid = uuid.uuid4().hex[:12]
    u = User(
        google_sub=f"invite-{uid}",
        email=f"invite-{uid}@example.com",
        display_name="Invitee",
    )
    db.add(u)
    db.commit()
    db.refresh(u)
    return u


@pytest.fixture
def other_user(db):
    uid = uuid.uuid4().hex[:12]
    u = User(
        google_sub=f"sender-{uid}",
        email=f"sender-{uid}@example.com",
        display_name="Sender",
    )
    db.add(u)
    db.commit()
    db.refresh(u)
    return u


@pytest.fixture
def household(db):
    h = Household(name="House A")
    db.add(h)
    db.commit()
    db.refresh(h)
    return h


@pytest.fixture
def inviter_member(db, other_user, household):
    m = Member(user_id=other_user.id, household_id=household.id)
    db.add(m)
    db.commit()
    db.refresh(m)
    return m


@pytest.fixture
def auth_headers(user):
    token = create_access_token(user.id, user.email)
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture
def client(db):
    def override_get_db():
        yield db

    app.dependency_overrides[get_db] = override_get_db
    with TestClient(app) as c:
        yield c
    app.dependency_overrides.clear()


def test_list_my_pending_invitations_shows_email_matches(client, db, user, inviter_member, household, auth_headers):
    pending_match = Invitation(
        household_id=household.id,
        email=user.email.lower(),
        invited_by_member_id=inviter_member.id,
        token=f"tok-{uuid.uuid4().hex[:16]}",
        status="pending",
    )
    accepted_match = Invitation(
        household_id=household.id,
        email=user.email.lower(),
        invited_by_member_id=inviter_member.id,
        token=f"tok-{uuid.uuid4().hex[:16]}",
        status="accepted",
    )
    pending_other_email = Invitation(
        household_id=household.id,
        email="someoneelse@example.com",
        invited_by_member_id=inviter_member.id,
        token=f"tok-{uuid.uuid4().hex[:16]}",
        status="pending",
    )
    db.add_all([pending_match, accepted_match, pending_other_email])
    db.commit()

    r = client.get("/api/invitations/my-pending", headers=auth_headers)
    assert r.status_code == 200
    data = r.json()
    assert len(data) == 1
    assert data[0]["id"] == pending_match.id
    assert data[0]["email"] == user.email.lower()
    assert data[0]["status"] == "pending"
    assert data[0]["household_name"] == household.name


def test_decline_my_pending_invitation_deletes_invite(client, db, user, inviter_member, household, auth_headers):
    inv = Invitation(
        household_id=household.id,
        email=user.email.lower(),
        invited_by_member_id=inviter_member.id,
        token=f"tok-{uuid.uuid4().hex[:16]}",
        status="pending",
    )
    db.add(inv)
    db.commit()
    db.refresh(inv)

    r = client.delete(f"/api/invitations/my-pending/{inv.id}", headers=auth_headers)
    assert r.status_code == 204
    assert db.get(Invitation, inv.id) is None


def test_decline_my_pending_invitation_404_for_other_email(client, db, inviter_member, household, auth_headers):
    inv = Invitation(
        household_id=household.id,
        email="other-person@example.com",
        invited_by_member_id=inviter_member.id,
        token=f"tok-{uuid.uuid4().hex[:16]}",
        status="pending",
    )
    db.add(inv)
    db.commit()
    db.refresh(inv)

    r = client.delete(f"/api/invitations/my-pending/{inv.id}", headers=auth_headers)
    assert r.status_code == 404
