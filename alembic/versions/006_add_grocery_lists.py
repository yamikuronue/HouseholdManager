"""Add grocery lists and grocery list items.

Revision ID: 006_grocery_lists
Revises: 005_meal_planner
Create Date: 2025-01-01 00:00:06.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "006_grocery_lists"
down_revision: Union[str, None] = "005_meal_planner"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "grocery_lists",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("household_id", sa.Integer(), nullable=False),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=True),
        sa.Column("updated_at", sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(
            ["household_id"],
            ["households.id"],
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        op.f("ix_grocery_lists_id"), "grocery_lists", ["id"], unique=False
    )
    op.create_index(
        op.f("ix_grocery_lists_household_id"),
        "grocery_lists",
        ["household_id"],
        unique=False,
    )

    op.create_table(
        "grocery_list_items",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("grocery_list_id", sa.Integer(), nullable=False),
        sa.Column("content", sa.String(length=500), nullable=False),
        sa.Column("is_section_header", sa.Boolean(), nullable=True, server_default="0"),
        sa.Column("position", sa.Integer(), nullable=True, server_default="0"),
        sa.Column("member_id", sa.Integer(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=True),
        sa.Column("updated_at", sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(
            ["grocery_list_id"],
            ["grocery_lists.id"],
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["member_id"],
            ["members.id"],
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        op.f("ix_grocery_list_items_id"), "grocery_list_items", ["id"], unique=False
    )
    op.create_index(
        op.f("ix_grocery_list_items_grocery_list_id"),
        "grocery_list_items",
        ["grocery_list_id"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index(op.f("ix_grocery_list_items_grocery_list_id"), table_name="grocery_list_items")
    op.drop_index(op.f("ix_grocery_list_items_id"), table_name="grocery_list_items")
    op.drop_table("grocery_list_items")
    op.drop_index(op.f("ix_grocery_lists_household_id"), table_name="grocery_lists")
    op.drop_index(op.f("ix_grocery_lists_id"), table_name="grocery_lists")
    op.drop_table("grocery_lists")
