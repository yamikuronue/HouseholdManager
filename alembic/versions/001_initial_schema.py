"""Initial schema: users, households, members, calendars.

Revision ID: 001_initial
Revises:
Create Date: 2025-01-01 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "001_initial"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Use if_not_exists so this can run on DBs that already have tables (e.g. from create_all).
    op.create_table(
        "users",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("google_sub", sa.String(length=255), nullable=False),
        sa.Column("email", sa.String(length=255), nullable=False),
        sa.Column("display_name", sa.String(length=255), nullable=True),
        sa.Column("avatar_url", sa.String(length=512), nullable=True),
        sa.Column("refresh_token", sa.Text(), nullable=True),
        sa.Column("access_token", sa.Text(), nullable=True),
        sa.Column("token_expiry", sa.DateTime(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=True),
        sa.Column("updated_at", sa.DateTime(), nullable=True),
        sa.PrimaryKeyConstraint("id"),
        if_not_exists=True,
    )
    op.create_index(op.f("ix_users_google_sub"), "users", ["google_sub"], unique=True, if_not_exists=True)
    op.create_index(op.f("ix_users_id"), "users", ["id"], unique=False, if_not_exists=True)

    op.create_table(
        "households",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=True),
        sa.Column("updated_at", sa.DateTime(), nullable=True),
        sa.PrimaryKeyConstraint("id"),
        if_not_exists=True,
    )
    op.create_index(op.f("ix_households_id"), "households", ["id"], unique=False, if_not_exists=True)

    op.create_table(
        "members",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("household_id", sa.Integer(), nullable=False),
        sa.Column("role", sa.String(length=64), nullable=True),
        sa.Column("joined_at", sa.DateTime(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=True),
        sa.Column("updated_at", sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(
            ["household_id"],
            ["households.id"],
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["user_id"],
            ["users.id"],
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("user_id", "household_id", name="uq_member_user_household"),
        if_not_exists=True,
    )
    op.create_index(op.f("ix_members_id"), "members", ["id"], unique=False, if_not_exists=True)

    op.create_table(
        "calendars",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("member_id", sa.Integer(), nullable=False),
        sa.Column("google_calendar_id", sa.String(length=255), nullable=False),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column("color", sa.String(length=32), nullable=True),
        sa.Column("is_visible", sa.Boolean(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=True),
        sa.Column("updated_at", sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(
            ["member_id"],
            ["members.id"],
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint(
            "member_id",
            "google_calendar_id",
            name="uq_calendar_member_google",
        ),
        if_not_exists=True,
    )
    op.create_index(op.f("ix_calendars_id"), "calendars", ["id"], unique=False, if_not_exists=True)


def downgrade() -> None:
    op.drop_index(op.f("ix_calendars_id"), table_name="calendars")
    op.drop_table("calendars")
    op.drop_index(op.f("ix_members_id"), table_name="members")
    op.drop_table("members")
    op.drop_index(op.f("ix_households_id"), table_name="households")
    op.drop_table("households")
    op.drop_index(op.f("ix_users_google_sub"), table_name="users")
    op.drop_index(op.f("ix_users_id"), table_name="users")
    op.drop_table("users")
