"""Tests for migration 011: shift planned_meals.meal_date back one day."""

import importlib.util
from datetime import date
from pathlib import Path

import pytest
from sqlalchemy import create_engine, event, select

from src.models.database import Base, PlannedMeal

MIGRATION_PATH = (
    Path(__file__).resolve().parent.parent
    / "alembic"
    / "versions"
    / "011_shift_planned_meal_dates.py"
)


def _load_migration():
    spec = importlib.util.spec_from_file_location("migration_011", MIGRATION_PATH)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


migration = _load_migration()


@pytest.fixture
def conn():
    """Isolated in-memory DB so shifting every row can't touch other tests' data."""
    engine = create_engine("sqlite://")

    @event.listens_for(engine, "connect")
    def _no_fk(dbapi_conn, _):
        dbapi_conn.execute("PRAGMA foreign_keys=OFF")

    Base.metadata.create_all(bind=engine, tables=[PlannedMeal.__table__])
    with engine.begin() as c:
        yield c
    engine.dispose()


def _insert(conn, rows):
    conn.execute(
        PlannedMeal.__table__.insert(),
        [
            {"id": i, "household_id": h, "meal_date": d, "meal_slot_id": s, "member_id": 1}
            for i, h, d, s in rows
        ],
    )


def _dates(conn):
    t = PlannedMeal.__table__
    return dict(conn.execute(select(t.c.id, t.c.meal_date).order_by(t.c.id)).fetchall())


def test_upgrade_shifts_back_one_day_without_unique_conflicts(conn):
    # Consecutive days in the same household/slot: a naive bulk update would
    # collide on uq_planned_meal_household_date_slot.
    _insert(
        conn,
        [
            (1, 1, date(2026, 10, 31), 1),
            (2, 1, date(2026, 11, 1), 1),
            (3, 1, date(2026, 11, 2), 1),
            (4, 2, date(2026, 3, 1), 3),
        ],
    )
    migration.shift_meal_dates(conn, -1)
    assert _dates(conn) == {
        1: date(2026, 10, 30),
        2: date(2026, 10, 31),
        3: date(2026, 11, 1),
        4: date(2026, 2, 28),
    }


def test_downgrade_restores_original_dates(conn):
    original = [
        (1, 1, date(2026, 12, 31), 1),
        (2, 1, date(2027, 1, 1), 1),
        (3, 1, date(2027, 1, 2), 2),
    ]
    _insert(conn, original)
    migration.shift_meal_dates(conn, -1)
    migration.shift_meal_dates(conn, 1)
    assert _dates(conn) == {i: d for i, _, d, _ in original}


def test_upgrade_and_downgrade_use_alembic_bind(conn, monkeypatch):
    monkeypatch.setattr(migration.op, "get_bind", lambda: conn, raising=False)
    _insert(conn, [(1, 1, date(2026, 10, 31), 1)])
    migration.upgrade()
    assert _dates(conn) == {1: date(2026, 10, 30)}
    migration.downgrade()
    assert _dates(conn) == {1: date(2026, 10, 31)}


def test_shift_on_empty_table_is_noop(conn):
    migration.shift_meal_dates(conn, -1)
    assert _dates(conn) == {}


def test_revision_chain():
    assert migration.revision == "011_shift_planned_meal_dates"
    assert migration.down_revision == "010_widen_user_avatar_url"
