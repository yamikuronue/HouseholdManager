"""Add member_id to todo_items for creator color.

Revision ID: 008_todo_member_id
Revises: 007_set_household_owners
Create Date: 2025-01-01 00:00:08.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "008_todo_member_id"
down_revision: Union[str, None] = "007_set_household_owners"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "todo_items",
        sa.Column("member_id", sa.Integer(), nullable=True),
    )
    op.create_foreign_key(
        "fk_todo_items_member_id",
        "todo_items",
        "members",
        ["member_id"],
        ["id"],
        ondelete="SET NULL",
    )


def downgrade() -> None:
    op.drop_constraint("fk_todo_items_member_id", "todo_items", type_="foreignkey")
    op.drop_column("todo_items", "member_id")
