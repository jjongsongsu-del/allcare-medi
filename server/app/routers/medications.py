from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.db import get_db
from app.models import Medication
from app.schemas import MedicationCreate, MedicationRead

router = APIRouter(prefix="/medications", tags=["medications"])


@router.get("", response_model=list[MedicationRead])
def list_medications(db: Session = Depends(get_db)) -> list[Medication]:
    return db.query(Medication).order_by(Medication.id.desc()).all()


@router.post("", response_model=MedicationRead)
def create_medication(payload: MedicationCreate, db: Session = Depends(get_db)) -> Medication:
    medication = Medication(**payload.model_dump())
    db.add(medication)
    db.commit()
    db.refresh(medication)
    return medication
