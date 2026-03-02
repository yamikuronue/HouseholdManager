"""Tests for events API: get events, writable calendars, create event."""

import uuid
from datetime import datetime, timezone
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from fastapi.testclient import TestClient

from src.api.main import app
from src.api.routes.auth import create_access_token
from src.db.session import get_db
from src.models.database import Calendar, Household, Member, User


@pytest.fixture
def user(db):
    uid = uuid.uuid4().hex[:12]
    u = User(
        google_sub=f"ev-{uid}",
        email=f"ev-{uid}@example.com",
        display_name="Event User",
        access_token="fake-token",
        token_expiry=datetime.now(timezone.utc),
    )
    db.add(u)
    db.commit()
    db.refresh(u)
    return u


@pytest.fixture
def other_user(db):
    uid = uuid.uuid4().hex[:12]
    u = User(
        google_sub=f"ev-other-{uid}",
        email=f"ev-other-{uid}@example.com",
        display_name="Other User",
        access_token="other-token",
        token_expiry=datetime.now(timezone.utc),
    )
    db.add(u)
    db.commit()
    db.refresh(u)
    return u


@pytest.fixture
def household(db):
    h = Household(name="Event Test Household")
    db.add(h)
    db.commit()
    db.refresh(h)
    return h


@pytest.fixture
def member(db, user, household):
    m = Member(user_id=user.id, household_id=household.id, event_color="#3788d8")
    db.add(m)
    db.commit()
    db.refresh(m)
    return m


@pytest.fixture
def other_member(db, other_user, household):
    m = Member(user_id=other_user.id, household_id=household.id, event_color="#888")
    db.add(m)
    db.commit()
    db.refresh(m)
    return m


@pytest.fixture
def calendar(db, member):
    cal = Calendar(
        member_id=member.id,
        google_calendar_id="primary",
        name="My Calendar",
        is_visible=True,
    )
    db.add(cal)
    db.commit()
    db.refresh(cal)
    return cal


@pytest.fixture
def other_calendar(db, other_member):
    cal = Calendar(
        member_id=other_member.id,
        google_calendar_id="other@group.calendar.google.com",
        name="Other Calendar",
        is_visible=True,
    )
    db.add(cal)
    db.commit()
    db.refresh(cal)
    return cal


@pytest.fixture
def auth_headers(user):
    token = create_access_token(user.id, user.email)
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture
def other_auth_headers(other_user):
    token = create_access_token(other_user.id, other_user.email)
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture
def client(db):
    def override_get_db():
        yield db

    app.dependency_overrides[get_db] = override_get_db
    with TestClient(app) as c:
        yield c
    app.dependency_overrides.clear()


# ----- GET /api/events/writable-calendars -----


def test_writable_calendars_returns_only_own(client, user, member, calendar, other_calendar, auth_headers):
    """Writable calendars lists only calendars owned by the current user."""
    r = client.get("/api/events/writable-calendars", headers=auth_headers)
    assert r.status_code == 200
    data = r.json()
    assert len(data) == 1
    assert data[0]["id"] == calendar.id
    assert data[0]["name"] == calendar.name


def test_writable_calendars_401_without_auth(client):
    r = client.get("/api/events/writable-calendars")
    assert r.status_code == 401


def test_writable_calendars_empty_when_none(client, user, auth_headers):
    """User with no calendars gets empty list."""
    r = client.get("/api/events/writable-calendars", headers=auth_headers)
    assert r.status_code == 200
    assert r.json() == []


# ----- POST /api/events (create) -----


def test_create_event_404_calendar_not_found(client, auth_headers):
    r = client.post(
        "/api/events",
        headers=auth_headers,
        json={
            "calendar_id": 99999,
            "title": "Test",
            "start": "2024-06-01T10:00:00Z",
            "end": "2024-06-01T11:00:00Z",
        },
    )
    assert r.status_code == 404
    assert "not found" in r.json()["detail"].lower()


def test_create_event_403_not_owner(client, calendar, other_auth_headers):
    """Other user cannot create event on calendar they don't own."""
    r = client.post(
        "/api/events",
        headers=other_auth_headers,
        json={
            "calendar_id": calendar.id,
            "title": "Test",
            "start": "2024-06-01T10:00:00Z",
            "end": "2024-06-01T11:00:00Z",
        },
    )
    assert r.status_code == 403
    assert "only add events" in r.json()["detail"].lower() or "own" in r.json()["detail"].lower()


def test_create_event_400_no_token(client, db, user, member, calendar, auth_headers):
    """User with no access_token gets 400."""
    user.access_token = None
    db.commit()
    r = client.post(
        "/api/events",
        headers=auth_headers,
        json={
            "calendar_id": calendar.id,
            "title": "Test",
            "start": "2024-06-01T10:00:00Z",
            "end": "2024-06-01T11:00:00Z",
        },
    )
    assert r.status_code == 400
    assert "token" in r.json()["detail"].lower()


@patch("src.api.routes.events.httpx.AsyncClient")
def test_create_event_success(mock_async_client, client, calendar, auth_headers):
    """Create event returns 200 and event with html_link when Google API succeeds."""
    mock_response = MagicMock()
    mock_response.status_code = 201
    mock_response.json.return_value = {
        "id": "google-event-id-123",
        "summary": "New Event",
        "description": "Desc",
        "location": "Office",
        "start": {"dateTime": "2024-06-01T10:00:00Z"},
        "end": {"dateTime": "2024-06-01T11:00:00Z"},
        "htmlLink": "https://www.google.com/calendar/event?eid=abc",
    }
    mock_post = AsyncMock(return_value=mock_response)
    mock_client_instance = MagicMock()
    mock_client_instance.post = mock_post
    mock_client_instance.__aenter__ = AsyncMock(return_value=mock_client_instance)
    mock_client_instance.__aexit__ = AsyncMock(return_value=None)
    mock_async_client.return_value = mock_client_instance

    r = client.post(
        "/api/events",
        headers=auth_headers,
        json={
            "calendar_id": calendar.id,
            "title": "New Event",
            "start": "2024-06-01T10:00:00Z",
            "end": "2024-06-01T11:00:00Z",
            "description": "Desc",
            "location": "Office",
        },
    )
    assert r.status_code == 200
    data = r.json()
    assert data["title"] == "New Event"
    assert data["html_link"] == "https://www.google.com/calendar/event?eid=abc"
    assert data["calendar_name"] == calendar.name
    mock_post.assert_called_once()


# ----- GET /api/events (includes html_link) -----


@patch("src.api.routes.events.httpx.AsyncClient")
def test_get_events_includes_html_link(mock_async_client, client, user, member, calendar, auth_headers):
    """GET events returns events with html_link from Google."""
    mock_response = MagicMock()
    mock_response.status_code = 200
    mock_response.json.return_value = {
        "items": [
            {
                "id": "ev1",
                "summary": "Meeting",
                "start": {"dateTime": "2024-06-01T14:00:00Z"},
                "end": {"dateTime": "2024-06-01T15:00:00Z"},
                "htmlLink": "https://www.google.com/calendar/event?eid=ev1",
            }
        ]
    }
    mock_get = AsyncMock(return_value=mock_response)
    mock_client_instance = MagicMock()
    mock_client_instance.get = mock_get
    mock_client_instance.__aenter__ = AsyncMock(return_value=mock_client_instance)
    mock_client_instance.__aexit__ = AsyncMock(return_value=None)
    mock_async_client.return_value = mock_client_instance

    r = client.get(
        "/api/events",
        params={"start_date": "2024-06-01T00:00:00Z", "end_date": "2024-06-30T23:59:59Z"},
        headers=auth_headers,
    )
    assert r.status_code == 200
    events = r.json()["events"]
    assert len(events) == 1
    assert events[0]["title"] == "Meeting"
    assert events[0]["html_link"] == "https://www.google.com/calendar/event?eid=ev1"


@patch("src.api.routes.events.httpx.AsyncClient")
def test_get_events_empty_when_no_calendars(mock_async_client, client, user, auth_headers):
    """User with no household memberships gets empty events."""
    r = client.get("/api/events", headers=auth_headers)
    assert r.status_code == 200
    assert r.json()["events"] == []
