"""Household CRUD routes."""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from src.db.session import get_db
from src.models.database import Household
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
    db.commit()
    db.refresh(household)
    return household


@router.delete("/{household_id}", status_code=204)
def delete_household(household_id: int, db: Session = Depends(get_db)):
    """Delete a household (cascades to members, calendars, invitations)."""
    household = db.get(Household, household_id)
    if not household:
        raise HTTPException(status_code=404, detail="Household not found")
    db.delete(household)
    db.commit()
    return None
