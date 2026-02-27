"""Add todo_items table for household to-do lists.

Revision ID: 004_todo_items
Revises: 003_event_color
Create Date: 2025-01-01 00:00:03.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "004_todo_items"
down_revision: Union[str, None] = "003_event_color"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "todo_items",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("household_id", sa.Integer(), nullable=False),
        sa.Column("content", sa.String(length=500), nullable=False),
        sa.Column("is_section_header", sa.Boolean(), nullable=True, server_default="0"),
        sa.Column("is_checked", sa.Boolean(), nullable=True, server_default="0"),
        sa.Column("checked_at", sa.DateTime(), nullable=True),
        sa.Column("position", sa.Integer(), nullable=True, server_default="0"),
        sa.Column("created_at", sa.DateTime(), nullable=True),
        sa.Column("updated_at", sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(
            ["household_id"],
            ["households.id"],
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id"),
        if_not_exists=True,
    )
    op.create_index(
        op.f("ix_todo_items_id"), "todo_items", ["id"], unique=False, if_not_exists=True
    )
    op.create_index(
        op.f("ix_todo_items_household_id"),
        "todo_items",
        ["household_id"],
        unique=False,
        if_not_exists=True,
    )


def downgrade() -> None:
    op.drop_index(op.f("ix_todo_items_household_id"), table_name="todo_items")
    op.drop_index(op.f("ix_todo_items_id"), table_name="todo_items")
    op.drop_table("todo_items")
