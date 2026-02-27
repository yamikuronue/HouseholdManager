"""Tests for meal planner API: meal slots and planned meals."""

import uuid
from datetime import date, timedelta

import pytest
from fastapi.testclient import TestClient

from src.api.main import app
from src.api.routes.auth import create_access_token
from src.db.session import get_db
from src.models.database import Household, MealSlot, Member, PlannedMeal, User


@pytest.fixture
def user(db):
    """Unique user per test so committed data from API doesn't cause UNIQUE violations."""
    uid = uuid.uuid4().hex[:12]
    u = User(
        google_sub=f"meal-{uid}",
        email=f"meal-{uid}@example.com",
        display_name="Meal User",
    )
    db.add(u)
    db.commit()
    db.refresh(u)
    return u


@pytest.fixture
def household(db):
    h = Household(name="Meal Test Household", meal_planner_weeks=2)
    db.add(h)
    db.commit()
    db.refresh(h)
    return h


@pytest.fixture
def member(db, user, household):
    m = Member(user_id=user.id, household_id=household.id, event_color="#abc")
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


# ----- Meal slots -----


def test_list_meal_slots_creates_defaults(client, user, household, member, auth_headers):
    """When household has no slots, list creates default Breakfast/Lunch/Dinner and returns them."""
    r = client.get("/api/meal-slots", params={"household_id": household.id}, headers=auth_headers)
    assert r.status_code == 200
    data = r.json()
    assert len(data) == 3
    names = [s["name"] for s in data]
    assert names == ["Breakfast", "Lunch", "Dinner"]
    assert all(s["household_id"] == household.id for s in data)


def test_list_meal_slots_403_when_not_member(client, user, household, auth_headers):
    r = client.get("/api/meal-slots", params={"household_id": household.id}, headers=auth_headers)
    assert r.status_code == 403


def test_create_meal_slot(client, user, household, member, auth_headers):
    r = client.post(
        "/api/meal-slots",
        json={"household_id": household.id, "name": "Snack"},
        headers=auth_headers,
    )
    assert r.status_code == 201
    data = r.json()
    assert data["name"] == "Snack"
    assert data["household_id"] == household.id
    assert "id" in data
    assert "position" in data


def test_update_meal_slot(client, user, household, member, auth_headers, db):
    slot = MealSlot(household_id=household.id, name="Brunch", position=0)
    db.add(slot)
    db.commit()
    db.refresh(slot)

    r = client.patch(
        f"/api/meal-slots/{slot.id}",
        json={"name": "Late Breakfast"},
        headers=auth_headers,
    )
    assert r.status_code == 200
    assert r.json()["name"] == "Late Breakfast"


def test_delete_meal_slot(client, user, household, member, auth_headers, db):
    slot = MealSlot(household_id=household.id, name="Snack", position=3)
    db.add(slot)
    db.commit()
    db.refresh(slot)

    r = client.delete(f"/api/meal-slots/{slot.id}", headers=auth_headers)
    assert r.status_code == 204

    r2 = client.get("/api/meal-slots", params={"household_id": household.id}, headers=auth_headers)
    data = r2.json()
    names = [s["name"] for s in data]
    assert "Snack" not in names
    assert len(data) == 3  # default slots only


def test_delete_meal_slot_403_when_other_household(client, user, auth_headers, db):
    other = Household(name="Other")
    db.add(other)
    db.commit()
    db.refresh(other)
    slot = MealSlot(household_id=other.id, name="Lunch", position=0)
    db.add(slot)
    db.commit()
    db.refresh(slot)

    r = client.delete(f"/api/meal-slots/{slot.id}", headers=auth_headers)
    assert r.status_code == 403


# ----- Planned meals -----


def _date_str(d):
    return d.isoformat()


def test_list_planned_meals_empty(client, user, household, member, auth_headers, db):
    """Need at least one slot to query; list returns empty when none planned."""
    slot = MealSlot(household_id=household.id, name="Lunch", position=0)
    db.add(slot)
    db.commit()
    start = date.today()
    end = start + timedelta(days=7)

    r = client.get(
        "/api/planned-meals",
        params={
            "household_id": household.id,
            "start_date": _date_str(start),
            "end_date": _date_str(end),
        },
        headers=auth_headers,
    )
    assert r.status_code == 200
    assert r.json() == []


def test_list_planned_meals_403_when_not_member(client, user, household, auth_headers):
    start = date.today()
    end = start + timedelta(days=7)
    r = client.get(
        "/api/planned-meals",
        params={
            "household_id": household.id,
            "start_date": _date_str(start),
            "end_date": _date_str(end),
        },
        headers=auth_headers,
    )
    assert r.status_code == 403


def test_create_planned_meal(client, user, household, member, auth_headers, db):
    slot = MealSlot(household_id=household.id, name="Dinner", position=2)
    db.add(slot)
    db.commit()
    db.refresh(slot)
    today = date.today()

    r = client.post(
        "/api/planned-meals",
        json={
            "household_id": household.id,
            "meal_date": _date_str(today),
            "meal_slot_id": slot.id,
            "member_id": member.id,
            "description": "Pasta",
        },
        headers=auth_headers,
    )
    assert r.status_code == 201
    data = r.json()
    assert data["meal_date"] == _date_str(today)
    assert data["meal_slot_id"] == slot.id
    assert data["member_id"] == member.id
    assert data["member_display_name"] == "Meal User"
    assert data["member_color"] == "#abc"
    assert data["description"] == "Pasta"


def test_create_planned_meal_403_when_member_other_user(client, user, household, member, auth_headers, db):
    """Cannot set another member as assignee; must use current user's member_id."""
    uid = uuid.uuid4().hex[:12]
    other_user = User(google_sub=f"other-{uid}", email=f"other-{uid}@example.com", display_name="Other")
    db.add(other_user)
    db.commit()
    db.refresh(other_user)
    other_member = Member(user_id=other_user.id, household_id=household.id)
    db.add(other_member)
    db.commit()
    db.refresh(other_member)
    slot = MealSlot(household_id=household.id, name="Lunch", position=0)
    db.add(slot)
    db.commit()
    db.refresh(slot)

    r = client.post(
        "/api/planned-meals",
        json={
            "household_id": household.id,
            "meal_date": _date_str(date.today()),
            "meal_slot_id": slot.id,
            "member_id": other_member.id,
        },
        headers=auth_headers,
    )
    assert r.status_code == 403


def test_delete_planned_meal(client, user, household, member, auth_headers, db):
    slot = MealSlot(household_id=household.id, name="Breakfast", position=0)
    db.add(slot)
    db.commit()
    db.refresh(slot)
    meal = PlannedMeal(
        household_id=household.id,
        meal_date=date.today(),
        meal_slot_id=slot.id,
        member_id=member.id,
    )
    db.add(meal)
    db.commit()
    db.refresh(meal)

    r = client.delete(f"/api/planned-meals/{meal.id}", headers=auth_headers)
    assert r.status_code == 204

    start = date.today()
    end = start + timedelta(days=1)
    r2 = client.get(
        "/api/planned-meals",
        params={
            "household_id": household.id,
            "start_date": _date_str(start),
            "end_date": _date_str(end),
        },
        headers=auth_headers,
    )
    assert meal.id not in [m["id"] for m in r2.json()]


def test_delete_planned_meal_403_when_other_household(client, user, auth_headers, db):
    """User cannot delete a planned meal that belongs to a household they are not in."""
    other = Household(name="Other")
    db.add(other)
    db.commit()
    db.refresh(other)
    uid = uuid.uuid4().hex[:12]
    other_user = User(google_sub=f"other-{uid}", email=f"other-{uid}@example.com")
    db.add(other_user)
    db.commit()
    db.refresh(other_user)
    other_member = Member(user_id=other_user.id, household_id=other.id)
    db.add(other_member)
    db.commit()
    db.refresh(other_member)
    slot = MealSlot(household_id=other.id, name="Lunch", position=0)
    db.add(slot)
    db.commit()
    db.refresh(slot)
    meal = PlannedMeal(
        household_id=other.id,
        meal_date=date.today(),
        meal_slot_id=slot.id,
        member_id=other_member.id,
    )
    db.add(meal)
    db.commit()
    db.refresh(meal)

    r = client.delete(f"/api/planned-meals/{meal.id}", headers=auth_headers)
    assert r.status_code == 403
