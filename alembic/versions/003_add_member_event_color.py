"""Add event_color to members.

Revision ID: 003_event_color
Revises: 002_invitations
Create Date: 2025-01-01 00:00:02.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "003_event_color"
down_revision: Union[str, None] = "002_invitations"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("members", sa.Column("event_color", sa.String(length=32), nullable=True))


def downgrade() -> None:
    op.drop_column("members", "event_color")
