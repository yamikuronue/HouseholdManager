"""Household to-do list routes. Only members of the household can access."""

from datetime import datetime, timedelta

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from src.api.routes.auth import get_current_user
from src.db.session import get_db
from src.models.database import Member, TodoItem, User
from src.models.schemas import (
    DEFAULT_MEMBER_EVENT_COLOR,
    TodoItemCreate,
    TodoItemResponse,
    TodoItemUpdate,
)

router = APIRouter(prefix="/api/todos", tags=["todos"])

DAYS_TO_KEEP_CHECKED = 7


def _ensure_member_of_household(db: Session, user_id: int, household_id: int) -> Member | None:
    member = (
        db.query(Member)
        .filter(Member.user_id == user_id, Member.household_id == household_id)
        .first()
    )
    if not member:
        raise HTTPException(
            status_code=403, detail="You must be a member of this household"
        )
    return member


def _ensure_can_access_todo(db: Session, user_id: int, todo: TodoItem) -> None:
    _ensure_member_of_household(db, user_id, todo.household_id)


def _todo_to_response(db: Session, item: TodoItem) -> TodoItemResponse:
    member_name = None
    member_color = None
    if item.member_id:
        member = db.get(Member, item.member_id)
        if member:
            if member.user_id:
                user = db.get(User, member.user_id)
                if user:
                    member_name = user.display_name or user.email
            member_color = (member.event_color if member else None) or DEFAULT_MEMBER_EVENT_COLOR
    return TodoItemResponse(
        id=item.id,
        household_id=item.household_id,
        content=item.content,
        is_section_header=item.is_section_header,
        is_checked=item.is_checked,
        checked_at=item.checked_at,
        position=item.position,
        created_at=item.created_at,
        member_id=item.member_id,
        member_display_name=member_name,
        member_color=member_color,
    )


@router.get("", response_model=list[TodoItemResponse])
def list_todos(
    household_id: int = Query(..., description="Household whose list to return"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """List to-do items for a household. Items checked off 7+ days ago are removed."""
    _ensure_member_of_household(db, current_user.id, household_id)

    cutoff = datetime.utcnow() - timedelta(days=DAYS_TO_KEEP_CHECKED)
    db.query(TodoItem).filter(
        TodoItem.household_id == household_id,
        TodoItem.is_checked.is_(True),
        TodoItem.checked_at < cutoff,
    ).delete(synchronize_session=False)
    db.commit()

    items = (
        db.query(TodoItem)
        .filter(TodoItem.household_id == household_id)
        .order_by(TodoItem.position.asc(), TodoItem.id.asc())
        .all()
    )
    return [_todo_to_response(db, item) for item in items]


@router.post("", response_model=TodoItemResponse, status_code=201)
def create_todo(
    body: TodoItemCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Add a to-do item or section header to a household list."""
    member = _ensure_member_of_household(db, current_user.id, body.household_id)

    position = body.position
    if position is None:
        max_pos = (
            db.query(TodoItem)
            .filter(TodoItem.household_id == body.household_id)
            .count()
        )
        position = max_pos

    item = TodoItem(
        household_id=body.household_id,
        member_id=member.id,
        content=body.content.strip() or "New item",
        is_section_header=body.is_section_header,
        position=position,
    )
    db.add(item)
    db.commit()
    db.refresh(item)
    return _todo_to_response(db, item)


@router.patch("/{todo_id}", response_model=TodoItemResponse)
def update_todo(
    todo_id: int,
    body: TodoItemUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Update a to-do item (content, section header, or checked state)."""
    item = db.get(TodoItem, todo_id)
    if not item:
        raise HTTPException(status_code=404, detail="Todo item not found")
    _ensure_can_access_todo(db, current_user.id, item)

    if body.content is not None:
        item.content = body.content.strip() if body.content else item.content
    if body.is_section_header is not None:
        item.is_section_header = body.is_section_header
    if body.position is not None:
        item.position = body.position
    if body.is_checked is not None:
        item.is_checked = body.is_checked
        item.checked_at = datetime.utcnow() if body.is_checked else None

    db.commit()
    db.refresh(item)
    return _todo_to_response(db, item)


@router.delete("/{todo_id}", status_code=204)
def delete_todo(
    todo_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Remove a to-do item from the list."""
    item = db.get(TodoItem, todo_id)
    if not item:
        raise HTTPException(status_code=404, detail="Todo item not found")
    _ensure_can_access_todo(db, current_user.id, item)
    db.delete(item)
    db.commit()
    return None
