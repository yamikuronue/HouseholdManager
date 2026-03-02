"""Set one owner per household (first member by id) for existing data.

Revision ID: 007_set_household_owners
Revises: 006_grocery_lists
Create Date: 2025-01-01 00:00:07.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "007_set_household_owners"
down_revision: Union[str, None] = "006_grocery_lists"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Set role='owner' for the first member (min id) of each household that has no owner yet.
    conn = op.get_bind()
    # Households with no owner: get the member with smallest id per household
    r = conn.execute(
        sa.text("""
            SELECT m.household_id, MIN(m.id) AS member_id
            FROM members m
            WHERE NOT EXISTS (
                SELECT 1 FROM members o
                WHERE o.household_id = m.household_id AND o.role = 'owner'
            )
            GROUP BY m.household_id
        """)
    )
    rows = r.fetchall()
    for row in rows:
        member_id = row[1]  # member_id column
        conn.execute(sa.text("UPDATE members SET role = 'owner' WHERE id = :id"), {"id": member_id})


def downgrade() -> None:
    # No safe way to revert; leave owners as-is.
    pass
