"""Grocery lists and items. Household members can create lists (e.g. Costco) and add/remove/reorder items."""

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from src.api.routes.auth import get_current_user
from src.db.session import get_db
from src.models.database import GroceryList, GroceryListItem, Member, User
from src.models.schemas import (
    GroceryListCreate,
    GroceryListResponse,
    GroceryListUpdate,
    GroceryListItemCreate,
    GroceryListItemResponse,
    GroceryListItemUpdate,
)

router = APIRouter(prefix="/api", tags=["grocery_lists"])

DEFAULT_LIST_NAME = "Groceries"


def _ensure_member(db: Session, user_id: int, household_id: int) -> Member:
    m = (
        db.query(Member)
        .filter(Member.user_id == user_id, Member.household_id == household_id)
        .first()
    )
    if not m:
        raise HTTPException(status_code=403, detail="Not a member of this household")
    return m


# ----- Lists -----


@router.get("/grocery-lists", response_model=list[GroceryListResponse])
def list_grocery_lists(
    household_id: int = Query(...),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """List grocery lists for a household. Creates a default 'Groceries' list if none exist."""
    _ensure_member(db, current_user.id, household_id)
    lists = (
        db.query(GroceryList)
        .filter(GroceryList.household_id == household_id)
        .order_by(GroceryList.id.asc())
        .all()
    )
    if not lists:
        new_list = GroceryList(household_id=household_id, name=DEFAULT_LIST_NAME)
        db.add(new_list)
        db.commit()
        db.refresh(new_list)
        lists = [new_list]
    return lists


@router.post("/grocery-lists", response_model=GroceryListResponse, status_code=201)
def create_grocery_list(
    body: GroceryListCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Add a new grocery list (e.g. store name like Costco)."""
    _ensure_member(db, current_user.id, body.household_id)
    name = (body.name or "").strip() or DEFAULT_LIST_NAME
    gl = GroceryList(household_id=body.household_id, name=name)
    db.add(gl)
    db.commit()
    db.refresh(gl)
    return gl


@router.patch("/grocery-lists/{list_id}", response_model=GroceryListResponse)
def update_grocery_list(
    list_id: int,
    body: GroceryListUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    gl = db.get(GroceryList, list_id)
    if not gl:
        raise HTTPException(status_code=404, detail="Grocery list not found")
    _ensure_member(db, current_user.id, gl.household_id)
    if body.name is not None:
        gl.name = (body.name or "").strip() or gl.name
    db.commit()
    db.refresh(gl)
    return gl


@router.delete("/grocery-lists/{list_id}", status_code=204)
def delete_grocery_list(
    list_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Delete a list. Forbidden if it is the household's last list."""
    gl = db.get(GroceryList, list_id)
    if not gl:
        raise HTTPException(status_code=404, detail="Grocery list not found")
    _ensure_member(db, current_user.id, gl.household_id)
    count = db.query(GroceryList).filter(GroceryList.household_id == gl.household_id).count()
    if count <= 1:
        raise HTTPException(
            status_code=400,
            detail="Cannot delete the last grocery list. Add another list first.",
        )
    db.delete(gl)
    db.commit()
    return None


# ----- Items -----


def _item_to_response(db: Session, item: GroceryListItem) -> GroceryListItemResponse:
    member_name = None
    member_color = None
    if item.member_id:
        member = db.get(Member, item.member_id)
        if member and member.user:
            member_name = member.user.display_name or member.user.email
            member_color = member.event_color
    return GroceryListItemResponse(
        id=item.id,
        grocery_list_id=item.grocery_list_id,
        content=item.content,
        is_section_header=item.is_section_header,
        position=item.position,
        member_id=item.member_id,
        member_display_name=member_name,
        member_color=member_color,
        created_at=item.created_at,
    )


@router.get("/grocery-list-items", response_model=list[GroceryListItemResponse])
def list_grocery_list_items(
    grocery_list_id: int = Query(...),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    gl = db.get(GroceryList, grocery_list_id)
    if not gl:
        raise HTTPException(status_code=404, detail="Grocery list not found")
    _ensure_member(db, current_user.id, gl.household_id)
    items = (
        db.query(GroceryListItem)
        .filter(GroceryListItem.grocery_list_id == grocery_list_id)
        .order_by(GroceryListItem.position.asc(), GroceryListItem.id.asc())
        .all()
    )
    return [_item_to_response(db, it) for it in items]


@router.post("/grocery-list-items", response_model=GroceryListItemResponse, status_code=201)
def create_grocery_list_item(
    body: GroceryListItemCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    gl = db.get(GroceryList, body.grocery_list_id)
    if not gl:
        raise HTTPException(status_code=404, detail="Grocery list not found")
    my_member = _ensure_member(db, current_user.id, gl.household_id)
    position = body.position
    if position is None:
        max_pos = (
            db.query(GroceryListItem)
            .filter(GroceryListItem.grocery_list_id == body.grocery_list_id)
            .count()
        )
        position = max_pos
    member_id = body.member_id if body.member_id is not None else my_member.id
    item = GroceryListItem(
        grocery_list_id=body.grocery_list_id,
        content=(body.content or "").strip() or "New item",
        is_section_header=body.is_section_header,
        position=position,
        member_id=member_id,
    )
    db.add(item)
    db.commit()
    db.refresh(item)
    return _item_to_response(db, item)


@router.patch("/grocery-list-items/{item_id}", response_model=GroceryListItemResponse)
def update_grocery_list_item(
    item_id: int,
    body: GroceryListItemUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    item = db.get(GroceryListItem, item_id)
    if not item:
        raise HTTPException(status_code=404, detail="Grocery list item not found")
    gl = db.get(GroceryList, item.grocery_list_id)
    _ensure_member(db, current_user.id, gl.household_id)
    if body.content is not None:
        item.content = (body.content or "").strip() or item.content
    if body.is_section_header is not None:
        item.is_section_header = body.is_section_header
    if body.position is not None:
        item.position = body.position
    db.commit()
    db.refresh(item)
    return _item_to_response(db, item)


@router.delete("/grocery-list-items/{item_id}", status_code=204)
def delete_grocery_list_item(
    item_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    item = db.get(GroceryListItem, item_id)
    if not item:
        raise HTTPException(status_code=404, detail="Grocery list item not found")
    gl = db.get(GroceryList, item.grocery_list_id)
    _ensure_member(db, current_user.id, gl.household_id)
    db.delete(item)
    db.commit()
    return None
