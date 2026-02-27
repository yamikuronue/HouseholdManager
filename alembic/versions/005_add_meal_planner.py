"""Add meal planner: meal_planner_weeks on households, meal_slots, planned_meals.

Revision ID: 005_meal_planner
Revises: 004_todo_items
Create Date: 2025-01-01 00:00:04.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "005_meal_planner"
down_revision: Union[str, None] = "004_todo_items"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "households",
        sa.Column("meal_planner_weeks", sa.Integer(), nullable=True, server_default="2"),
    )

    op.create_table(
        "meal_slots",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("household_id", sa.Integer(), nullable=False),
        sa.Column("name", sa.String(length=64), nullable=False),
        sa.Column("position", sa.Integer(), nullable=True, server_default="0"),
        sa.Column("created_at", sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(
            ["household_id"],
            ["households.id"],
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id"),
        if_not_exists=True,
    )
    op.create_index(
        op.f("ix_meal_slots_id"), "meal_slots", ["id"], unique=False, if_not_exists=True
    )
    op.create_index(
        op.f("ix_meal_slots_household_id"),
        "meal_slots",
        ["household_id"],
        unique=False,
        if_not_exists=True,
    )

    op.create_table(
        "planned_meals",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("household_id", sa.Integer(), nullable=False),
        sa.Column("meal_date", sa.Date(), nullable=False),
        sa.Column("meal_slot_id", sa.Integer(), nullable=False),
        sa.Column("member_id", sa.Integer(), nullable=False),
        sa.Column("description", sa.String(length=200), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(
            ["household_id"],
            ["households.id"],
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["meal_slot_id"],
            ["meal_slots.id"],
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["member_id"],
            ["members.id"],
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint(
            "household_id",
            "meal_date",
            "meal_slot_id",
            name="uq_planned_meal_household_date_slot",
        ),
        if_not_exists=True,
    )
    op.create_index(
        op.f("ix_planned_meals_id"),
        "planned_meals",
        ["id"],
        unique=False,
        if_not_exists=True,
    )
    op.create_index(
        op.f("ix_planned_meals_household_id"),
        "planned_meals",
        ["household_id"],
        unique=False,
        if_not_exists=True,
    )


def downgrade() -> None:
    op.drop_index(op.f("ix_planned_meals_household_id"), table_name="planned_meals")
    op.drop_index(op.f("ix_planned_meals_id"), table_name="planned_meals")
    op.drop_table("planned_meals")
    op.drop_index(op.f("ix_meal_slots_household_id"), table_name="meal_slots")
    op.drop_index(op.f("ix_meal_slots_id"), table_name="meal_slots")
    op.drop_table("meal_slots")
    op.drop_column("households", "meal_planner_weeks")
