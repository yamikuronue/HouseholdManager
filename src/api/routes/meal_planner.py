"""Meal planner: meal slots (config) and planned meals. Household members only."""

from datetime import date, datetime

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session, joinedload

from src.api.routes.auth import get_current_user
from src.db.session import get_db
from src.models.database import Household, MealSlot, Member, PlannedMeal, User
from src.models.schemas import (
    MealSlotCreate,
    MealSlotResponse,
    MealSlotUpdate,
    PlannedMealCreate,
    PlannedMealResponse,
)

router = APIRouter(prefix="/api", tags=["meal_planner"])

DEFAULT_MEAL_SLOTS = [("Breakfast", 0), ("Lunch", 1), ("Dinner", 2)]


def _ensure_member(db: Session, user_id: int, household_id: int) -> Member:
    m = (
        db.query(Member)
        .filter(Member.user_id == user_id, Member.household_id == household_id)
        .first()
    )
    if not m:
        raise HTTPException(status_code=403, detail="Not a member of this household")
    return m


@router.get("/meal-slots", response_model=list[MealSlotResponse])
def list_meal_slots(
    household_id: int = Query(...),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """List meal slots for a household (e.g. Breakfast, Lunch, Dinner). Creates defaults if none exist."""
    _ensure_member(db, current_user.id, household_id)
    slots = (
        db.query(MealSlot)
        .filter(MealSlot.household_id == household_id)
        .order_by(MealSlot.position.asc(), MealSlot.id.asc())
        .all()
    )
    if not slots:
        for name, pos in DEFAULT_MEAL_SLOTS:
            s = MealSlot(household_id=household_id, name=name, position=pos)
            db.add(s)
        db.commit()
        slots = (
            db.query(MealSlot)
            .filter(MealSlot.household_id == household_id)
            .order_by(MealSlot.position.asc(), MealSlot.id.asc())
            .all()
        )
    return slots


@router.post("/meal-slots", response_model=MealSlotResponse, status_code=201)
def create_meal_slot(
    body: MealSlotCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Add a meal type (e.g. Snack). Only household members."""
    _ensure_member(db, current_user.id, body.household_id)
    position = body.position
    if position is None:
        max_pos = db.query(MealSlot).filter(MealSlot.household_id == body.household_id).count()
        position = max_pos
    slot = MealSlot(household_id=body.household_id, name=body.name.strip() or "Meal", position=position)
    db.add(slot)
    db.commit()
    db.refresh(slot)
    return slot


@router.patch("/meal-slots/{slot_id}", response_model=MealSlotResponse)
def update_meal_slot(
    slot_id: int,
    body: MealSlotUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Update meal slot name or position."""
    slot = db.get(MealSlot, slot_id)
    if not slot:
        raise HTTPException(status_code=404, detail="Meal slot not found")
    _ensure_member(db, current_user.id, slot.household_id)
    if body.name is not None:
        slot.name = body.name.strip() or slot.name
    if body.position is not None:
        slot.position = body.position
    db.commit()
    db.refresh(slot)
    return slot


@router.delete("/meal-slots/{slot_id}", status_code=204)
def delete_meal_slot(
    slot_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Remove a meal slot (and its planned meals)."""
    slot = db.get(MealSlot, slot_id)
    if not slot:
        raise HTTPException(status_code=404, detail="Meal slot not found")
    _ensure_member(db, current_user.id, slot.household_id)
    db.delete(slot)
    db.commit()
    return None


@router.get("/planned-meals", response_model=list[PlannedMealResponse])
def list_planned_meals(
    household_id: int = Query(...),
    start_date: date = Query(...),
    end_date: date = Query(...),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """List planned meals in a date range. Returns member display name and color for UI."""
    _ensure_member(db, current_user.id, household_id)
    meals = (
        db.query(PlannedMeal)
        .filter(
            PlannedMeal.household_id == household_id,
            PlannedMeal.meal_date >= start_date,
            PlannedMeal.meal_date <= end_date,
        )
        .options(
            joinedload(PlannedMeal.member).joinedload(Member.user),
        )
        .all()
    )
    return [
        PlannedMealResponse(
            id=m.id,
            household_id=m.household_id,
            meal_date=m.meal_date.isoformat(),
            meal_slot_id=m.meal_slot_id,
            member_id=m.member_id,
            member_display_name=m.member.user.display_name or m.member.user.email,
            member_color=m.member.event_color,
            description=m.description,
            created_at=m.created_at,
        )
        for m in meals
    ]


@router.post("/planned-meals", response_model=PlannedMealResponse, status_code=201)
def create_or_update_planned_meal(
    body: PlannedMealCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Add or update a planned meal for a day/slot. Member must be current user's membership for that household."""
    my_member = _ensure_member(db, current_user.id, body.household_id)
    if body.member_id != my_member.id:
        raise HTTPException(status_code=403, detail="Can only set yourself as the meal assignee")
    meal_date = date.fromisoformat(body.meal_date)
    existing = (
        db.query(PlannedMeal)
        .filter(
            PlannedMeal.household_id == body.household_id,
            PlannedMeal.meal_date == meal_date,
            PlannedMeal.meal_slot_id == body.meal_slot_id,
        )
        .first()
    )
    if existing:
        existing.member_id = body.member_id
        existing.description = body.description
        db.commit()
        db.refresh(existing)
        existing.member = db.get(Member, existing.member_id)
        existing.member.user = db.get(User, existing.member.user_id)
        return PlannedMealResponse(
            id=existing.id,
            household_id=existing.household_id,
            meal_date=existing.meal_date.isoformat(),
            meal_slot_id=existing.meal_slot_id,
            member_id=existing.member_id,
            member_display_name=existing.member.user.display_name or existing.member.user.email,
            member_color=existing.member.event_color,
            description=existing.description,
            created_at=existing.created_at,
        )
    meal = PlannedMeal(
        household_id=body.household_id,
        meal_date=meal_date,
        meal_slot_id=body.meal_slot_id,
        member_id=body.member_id,
        description=body.description,
    )
    db.add(meal)
    db.commit()
    db.refresh(meal)
    meal.member = db.get(Member, meal.member_id)
    meal.member.user = db.get(User, meal.member.user_id)
    return PlannedMealResponse(
        id=meal.id,
        household_id=meal.household_id,
        meal_date=meal.meal_date.isoformat(),
        meal_slot_id=meal.meal_slot_id,
        member_id=meal.member_id,
        member_display_name=meal.member.user.display_name or meal.member.user.email,
        member_color=meal.member.event_color,
        description=meal.description,
        created_at=meal.created_at,
    )


@router.delete("/planned-meals/{meal_id}", status_code=204)
def delete_planned_meal(
    meal_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Remove a planned meal."""
    meal = db.get(PlannedMeal, meal_id)
    if not meal:
        raise HTTPException(status_code=404, detail="Planned meal not found")
    _ensure_member(db, current_user.id, meal.household_id)
    db.delete(meal)
    db.commit()
    return None
