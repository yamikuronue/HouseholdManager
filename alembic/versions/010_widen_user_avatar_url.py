"""Widen users.avatar_url to TEXT (Google profile URLs can exceed 512 chars).

Revision ID: 010_widen_user_avatar_url
Revises: 009_grocery_item_checked
Create Date: 2026-04-22 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "010_widen_user_avatar_url"
down_revision: Union[str, None] = "009_grocery_item_checked"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    bind = op.get_bind()
    dialect = bind.dialect.name if bind is not None else ""

    if dialect == "sqlite":
        with op.batch_alter_table("users") as batch_op:
            batch_op.alter_column(
                "avatar_url",
                existing_type=sa.String(length=512),
                type_=sa.Text(),
                existing_nullable=True,
            )
    else:
        # Postgres and other DBs: widen column in place
        op.alter_column(
            "users",
            "avatar_url",
            existing_type=sa.String(length=512),
            type_=sa.Text(),
            existing_nullable=True,
        )


def downgrade() -> None:
    bind = op.get_bind()
    dialect = bind.dialect.name if bind is not None else ""

    if dialect == "sqlite":
        with op.batch_alter_table("users") as batch_op:
            batch_op.alter_column(
                "avatar_url",
                existing_type=sa.Text(),
                type_=sa.String(length=512),
                existing_nullable=True,
            )
    else:
        op.alter_column(
            "users",
            "avatar_url",
            existing_type=sa.Text(),
            type_=sa.String(length=512),
            existing_nullable=True,
        )
