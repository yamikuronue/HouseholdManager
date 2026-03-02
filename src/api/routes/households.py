"""Household CRUD routes."""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from src.api.routes.auth import get_current_user
from src.db.session import get_db
from src.models.database import Household, Member
from src.models.database import User
from src.models.schemas import HouseholdCreate, HouseholdResponse, HouseholdUpdate

router = APIRouter(prefix="/api/households", tags=["households"])


@router.get("", response_model=list[HouseholdResponse])
def list_households(db: Session = Depends(get_db)):
    """List all households."""
    return db.query(Household).all()


@router.post("", response_model=HouseholdResponse, status_code=201)
def create_household(body: HouseholdCreate, db: Session = Depends(get_db)):
    """Create a household."""
    household = Household(name=body.name)
    db.add(household)
    db.commit()
    db.refresh(household)
    return household


@router.get("/{household_id}", response_model=HouseholdResponse)
def get_household(household_id: int, db: Session = Depends(get_db)):
    """Get a household by id."""
    household = db.get(Household, household_id)
    if not household:
        raise HTTPException(status_code=404, detail="Household not found")
    return household


@router.patch("/{household_id}", response_model=HouseholdResponse)
def update_household(
    household_id: int, body: HouseholdUpdate, db: Session = Depends(get_db)
):
    """Update a household."""
    household = db.get(Household, household_id)
    if not household:
        raise HTTPException(status_code=404, detail="Household not found")
    if body.name is not None:
        household.name = body.name
    if body.meal_planner_weeks is not None:
        household.meal_planner_weeks = max(1, min(4, body.meal_planner_weeks))
    db.commit()
    db.refresh(household)
    return household


@router.delete("/{household_id}", status_code=204)
def delete_household(
    household_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Delete a household and all related records. Only the household owner may delete."""
    household = db.get(Household, household_id)
    if not household:
        raise HTTPException(status_code=404, detail="Household not found")
    member = (
        db.query(Member)
        .filter(
            Member.household_id == household_id,
            Member.user_id == current_user.id,
        )
        .first()
    )
    if not member:
        raise HTTPException(status_code=403, detail="You are not a member of this household")
    if member.role != "owner":
        raise HTTPException(status_code=403, detail="Only the household owner can delete the household")
    db.delete(household)
    db.commit()
    return None
