"""Shift planned_meals.meal_date back one day.

The meal planner UI built date keys via UTC (toISOString) and labelled rows by
parsing them as UTC midnight, so for users west of UTC every meal was stored one
day later than the row it was entered in. The UI now uses local dates; this
moves existing rows back to the day users actually picked.

Revision ID: 011_shift_planned_meal_dates
Revises: 010_widen_user_avatar_url
Create Date: 2026-10-28 00:00:00.000000

"""
from datetime import timedelta
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "011_shift_planned_meal_dates"
down_revision: Union[str, None] = "010_widen_user_avatar_url"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

planned_meals = sa.table(
    "planned_meals",
    sa.column("id", sa.Integer),
    sa.column("meal_date", sa.Date),
)


def shift_meal_dates(conn, days: int) -> None:
    # Every row shifts by the same amount, so the end state can't violate
    # uq_planned_meal_household_date_slot. Postgres checks that constraint per
    # row, so update one row at a time, starting from the end the rows move
    # towards, so each target date has already been vacated.
    order = planned_meals.c.meal_date.asc() if days < 0 else planned_meals.c.meal_date.desc()
    rows = conn.execute(
        sa.select(planned_meals.c.id, planned_meals.c.meal_date).order_by(order)
    ).fetchall()
    for meal_id, meal_date in rows:
        conn.execute(
            planned_meals.update()
            .where(planned_meals.c.id == meal_id)
            .values(meal_date=meal_date + timedelta(days=days))
        )


def upgrade() -> None:
    shift_meal_dates(op.get_bind(), -1)


def downgrade() -> None:
    shift_meal_dates(op.get_bind(), 1)
