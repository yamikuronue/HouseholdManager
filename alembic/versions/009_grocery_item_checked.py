"""Add is_checked to grocery_list_items.

Revision ID: 009_grocery_item_checked
Revises: 008_todo_member_id
Create Date: 2026-04-15 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "009_grocery_item_checked"
down_revision: Union[str, None] = "008_todo_member_id"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "grocery_list_items",
        sa.Column("is_checked", sa.Boolean(), nullable=True, server_default="0"),
    )


def downgrade() -> None:
    op.drop_column("grocery_list_items", "is_checked")
