"""SQLAlchemy database models.

Data layout: Household → Member → Calendar; User holds Google identity and tokens.
See docs/DATA_MODEL.md for full design.
"""

from datetime import datetime
from sqlalchemy import (
    Boolean,
    Column,
    DateTime,
    ForeignKey,
    Integer,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.orm import relationship
from sqlalchemy.ext.declarative import declarative_base

Base = declarative_base()


class User(Base):
    """One per Google account. Holds OAuth identity and tokens."""

    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    google_sub = Column(String(255), unique=True, nullable=False, index=True)
    email = Column(String(255), nullable=False)
    display_name = Column(String(255), nullable=True)
    avatar_url = Column(String(512), nullable=True)
    refresh_token = Column(Text, nullable=True)  # Store encrypted in production
    access_token = Column(Text, nullable=True)
    token_expiry = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    memberships = relationship("Member", back_populates="user", cascade="all, delete-orphan")


class Household(Base):
    """Top-level container. One household has many members and a shared calendar view."""

    __tablename__ = "households"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(255), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    members = relationship("Member", back_populates="household", cascade="all, delete-orphan")
    invitations = relationship(
        "Invitation", back_populates="household", cascade="all, delete-orphan"
    )
    todo_items = relationship(
        "TodoItem", back_populates="household", cascade="all, delete-orphan"
    )


class Member(Base):
    """Links a User to a Household. A user can be in multiple households."""

    __tablename__ = "members"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    household_id = Column(
        Integer, ForeignKey("households.id", ondelete="CASCADE"), nullable=False
    )
    role = Column(String(64), nullable=True)  # e.g. "owner", "member"
    event_color = Column(String(32), nullable=True)  # hex for calendar event display
    joined_at = Column(DateTime, default=datetime.utcnow)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    __table_args__ = (UniqueConstraint("user_id", "household_id", name="uq_member_user_household"),)

    user = relationship("User", back_populates="memberships")
    household = relationship("Household", back_populates="members")
    calendars = relationship(
        "Calendar", back_populates="member", cascade="all, delete-orphan"
    )
    invitations_sent = relationship(
        "Invitation",
        back_populates="invited_by",
        cascade="all, delete-orphan",
        foreign_keys="Invitation.invited_by_member_id",
    )


class Calendar(Base):
    """A Google calendar added by a member. Visible to all members of that household."""

    __tablename__ = "calendars"

    id = Column(Integer, primary_key=True, index=True)
    member_id = Column(Integer, ForeignKey("members.id", ondelete="CASCADE"), nullable=False)
    google_calendar_id = Column(String(255), nullable=False)
    name = Column(String(255), nullable=False)
    color = Column(String(32), nullable=True)
    is_visible = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    __table_args__ = (
        UniqueConstraint("member_id", "google_calendar_id", name="uq_calendar_member_google"),
    )

    member = relationship("Member", back_populates="calendars")


class Invitation(Base):
    """Invitation for someone (by email) to join a household. Accepted invite creates a Member."""

    __tablename__ = "invitations"

    id = Column(Integer, primary_key=True, index=True)
    household_id = Column(
        Integer, ForeignKey("households.id", ondelete="CASCADE"), nullable=False
    )
    email = Column(String(255), nullable=False)
    invited_by_member_id = Column(
        Integer, ForeignKey("members.id", ondelete="CASCADE"), nullable=False
    )
    token = Column(String(64), unique=True, nullable=False, index=True)
    status = Column(String(32), nullable=False, default="pending")  # pending | accepted | expired
    sent_at = Column(DateTime, default=datetime.utcnow)
    last_sent_at = Column(DateTime, default=datetime.utcnow)
    accepted_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    household = relationship("Household", back_populates="invitations")
    invited_by = relationship("Member", back_populates="invitations_sent")


class TodoItem(Base):
    """One item on a household's shared to-do list. Can be a regular item or a section header."""

    __tablename__ = "todo_items"

    id = Column(Integer, primary_key=True, index=True)
    household_id = Column(
        Integer, ForeignKey("households.id", ondelete="CASCADE"), nullable=False
    )
    content = Column(String(500), nullable=False)
    is_section_header = Column(Boolean, default=False)
    is_checked = Column(Boolean, default=False)
    checked_at = Column(DateTime, nullable=True)  # when checked; items checked 7+ days ago are auto-removed
    position = Column(Integer, default=0)  # display order
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    household = relationship("Household", back_populates="todo_items")
