"""Tests for household to-do list API and model."""

import uuid

import pytest
from fastapi.testclient import TestClient

from src.api.main import app
from src.api.routes.auth import create_access_token
from src.db.session import get_db
from src.models.database import Household, Member, TodoItem, User


@pytest.fixture
def user(db):
    """Unique user per test so committed data from API doesn't cause UNIQUE violations."""
    uid = uuid.uuid4().hex[:12]
    u = User(
        google_sub=f"todo-{uid}",
        email=f"todo-{uid}@example.com",
        display_name="Test User",
    )
    db.add(u)
    db.commit()
    db.refresh(u)
    return u


@pytest.fixture
def household(db):
    h = Household(name="Test Household")
    db.add(h)
    db.commit()
    db.refresh(h)
    return h


@pytest.fixture
def member(db, user, household):
    m = Member(user_id=user.id, household_id=household.id)
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


def test_list_todos_empty(client, user, household, member, auth_headers):
    r = client.get("/api/todos", params={"household_id": household.id}, headers=auth_headers)
    assert r.status_code == 200
    assert r.json() == []


def test_list_todos_403_when_not_member(client, user, household, auth_headers):
    # user is not a member of household (no Member row)
    r = client.get("/api/todos", params={"household_id": household.id}, headers=auth_headers)
    assert r.status_code == 403


def test_create_todo(client, user, household, member, auth_headers):
    r = client.post(
        "/api/todos",
        json={"household_id": household.id, "content": "Buy milk", "is_section_header": False},
        headers=auth_headers,
    )
    assert r.status_code == 201
    data = r.json()
    assert data["content"] == "Buy milk"
    assert data["household_id"] == household.id
    assert data["is_section_header"] is False
    assert data["is_checked"] is False
    assert "id" in data


def test_create_section_header(client, user, household, member, auth_headers):
    r = client.post(
        "/api/todos",
        json={"household_id": household.id, "content": "Groceries", "is_section_header": True},
        headers=auth_headers,
    )
    assert r.status_code == 201
    assert r.json()["is_section_header"] is True
    assert r.json()["content"] == "Groceries"


def test_update_todo_check(client, user, household, member, auth_headers, db):
    item = TodoItem(household_id=household.id, content="Task", is_section_header=False)
    db.add(item)
    db.commit()
    db.refresh(item)

    r = client.patch(
        f"/api/todos/{item.id}",
        json={"is_checked": True},
        headers=auth_headers,
    )
    assert r.status_code == 200
    data = r.json()
    assert data["is_checked"] is True
    assert data["checked_at"] is not None


def test_delete_todo(client, user, household, member, auth_headers, db):
    item = TodoItem(household_id=household.id, content="To remove", is_section_header=False)
    db.add(item)
    db.commit()
    db.refresh(item)

    r = client.delete(f"/api/todos/{item.id}", headers=auth_headers)
    assert r.status_code == 204

    r2 = client.get("/api/todos", params={"household_id": household.id}, headers=auth_headers)
    assert r2.status_code == 200
    items = r2.json()
    assert not any(x["content"] == "To remove" for x in items)


def test_delete_todo_403_when_other_household(client, user, auth_headers, db):
    """User cannot delete a todo that belongs to a household they are not in."""
    other_household = Household(name="Other")
    db.add(other_household)
    db.commit()
    db.refresh(other_household)

    item = TodoItem(
        household_id=other_household.id,
        content="Other household task",
        is_section_header=False,
    )
    db.add(item)
    db.commit()
    db.refresh(item)

    r = client.delete(f"/api/todos/{item.id}", headers=auth_headers)
    assert r.status_code == 403
