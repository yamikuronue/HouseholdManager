"""Tests for member updates (event color permissions)."""

import uuid

import pytest
from fastapi.testclient import TestClient

from src.api.main import app
from src.api.routes.auth import create_access_token
from src.db.session import get_db
from src.models.database import Household, Member, User


@pytest.fixture
def owner_user(db):
    uid = uuid.uuid4().hex[:12]
    u = User(
        google_sub=f"owner-{uid}",
        email=f"owner-{uid}@example.com",
        display_name="Owner",
    )
    db.add(u)
    db.commit()
    db.refresh(u)
    return u


@pytest.fixture
def member_user(db):
    uid = uuid.uuid4().hex[:12]
    u = User(
        google_sub=f"member-{uid}",
        email=f"member-{uid}@example.com",
        display_name="Member",
    )
    db.add(u)
    db.commit()
    db.refresh(u)
    return u


@pytest.fixture
def household(db):
    h = Household(name="Color House")
    db.add(h)
    db.commit()
    db.refresh(h)
    return h


@pytest.fixture
def owner_membership(db, owner_user, household):
    m = Member(user_id=owner_user.id, household_id=household.id, role="owner", event_color="#111111")
    db.add(m)
    db.commit()
    db.refresh(m)
    return m


@pytest.fixture
def other_membership(db, member_user, household):
    m = Member(user_id=member_user.id, household_id=household.id, role="member", event_color="#222222")
    db.add(m)
    db.commit()
    db.refresh(m)
    return m


@pytest.fixture
def client(db):
    def override_get_db():
        yield db

    app.dependency_overrides[get_db] = override_get_db
    with TestClient(app) as c:
        yield c
    app.dependency_overrides.clear()


def _headers(user):
    token = create_access_token(user.id, user.email)
    return {"Authorization": f"Bearer {token}"}


def test_owner_can_change_another_members_color(client, owner_user, other_membership):
    r = client.patch(
        f"/api/members/{other_membership.id}",
        json={"event_color": "#aabbcc"},
        headers=_headers(owner_user),
    )
    assert r.status_code == 200
    assert r.json()["event_color"] == "#aabbcc"


def test_member_cannot_change_another_members_color(client, member_user, owner_membership):
    r = client.patch(
        f"/api/members/{owner_membership.id}",
        json={"event_color": "#aabbcc"},
        headers=_headers(member_user),
    )
    assert r.status_code == 403
    assert "owner" in r.json()["detail"].lower()


def test_member_can_change_own_color(client, member_user, other_membership):
    r = client.patch(
        f"/api/members/{other_membership.id}",
        json={"event_color": "#ddeeff"},
        headers=_headers(member_user),
    )
    assert r.status_code == 200
    assert r.json()["event_color"] == "#ddeeff"
