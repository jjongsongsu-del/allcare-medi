import json

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.db import get_db
from app.models import Medication, MedicationEvent, MedicationSchedule
from app.schemas import (
    MedicationCreate,
    MedicationEventCreate,
    MedicationEventRead,
    MedicationRead,
    MedicationScheduleCreate,
    MedicationScheduleRead,
)

router = APIRouter(prefix="/medications", tags=["medications"])


@router.get("", response_model=list[MedicationRead])
def list_medications(user_id: int | None = None, profile_id: int | None = None, db: Session = Depends(get_db)) -> list[Medication]:
    query = db.query(Medication)
    if user_id is not None:
        query = query.filter(Medication.user_id == user_id)
    if profile_id is not None:
        query = query.filter(Medication.profile_id == profile_id)
    return query.order_by(Medication.id.desc()).all()


@router.post("", response_model=MedicationRead)
def create_medication(payload: MedicationCreate, db: Session = Depends(get_db)) -> Medication:
    data = payload.model_dump()
    data["product_name"] = data.get("product_name") or data["name"]
    data["ingredient"] = data.get("ingredient") or ""
    medication = Medication(**data)
    db.add(medication)
    db.commit()
    db.refresh(medication)
    return medication


@router.patch("/{medication_id}", response_model=MedicationRead)
def update_medication(medication_id: int, payload: MedicationCreate, db: Session = Depends(get_db)) -> Medication:
    medication = db.get(Medication, medication_id)
    if medication is None:
        raise HTTPException(status_code=404, detail="Medication not found")
    data = payload.model_dump()
    data["product_name"] = data.get("product_name") or data["name"]
    data["ingredient"] = data.get("ingredient") or ""
    for key, value in data.items():
        setattr(medication, key, value)
    db.commit()
    db.refresh(medication)
    return medication


@router.get("/schedules", response_model=list[MedicationScheduleRead])
def list_schedules(medication_id: int | None = None, profile_id: int | None = None, db: Session = Depends(get_db)) -> list[MedicationScheduleRead]:
    query = db.query(MedicationSchedule)
    if medication_id is not None:
        query = query.filter(MedicationSchedule.medication_id == medication_id)
    if profile_id is not None:
        query = query.filter(MedicationSchedule.profile_id == profile_id)
    return [to_schedule_read(schedule) for schedule in query.order_by(MedicationSchedule.id.desc()).all()]


@router.post("/schedules", response_model=MedicationScheduleRead)
def create_schedule(payload: MedicationScheduleCreate, db: Session = Depends(get_db)) -> MedicationScheduleRead:
    schedule = MedicationSchedule(**{**payload.model_dump(exclude={"dose_times"}), "dose_times": json.dumps(payload.dose_times, ensure_ascii=False)})
    db.add(schedule)
    db.commit()
    db.refresh(schedule)
    return to_schedule_read(schedule)


@router.get("/events", response_model=list[MedicationEventRead])
def list_events(medication_id: int | None = None, profile_id: int | None = None, db: Session = Depends(get_db)) -> list[MedicationEvent]:
    query = db.query(MedicationEvent)
    if medication_id is not None:
        query = query.filter(MedicationEvent.medication_id == medication_id)
    if profile_id is not None:
        query = query.filter(MedicationEvent.profile_id == profile_id)
    return query.order_by(MedicationEvent.id.desc()).all()


@router.post("/events", response_model=MedicationEventRead)
def create_event(payload: MedicationEventCreate, db: Session = Depends(get_db)) -> MedicationEvent:
    event = MedicationEvent(**payload.model_dump())
    db.add(event)
    db.commit()
    db.refresh(event)
    return event


def to_schedule_read(schedule: MedicationSchedule) -> MedicationScheduleRead:
    try:
        dose_times = json.loads(schedule.dose_times)
    except json.JSONDecodeError:
        dose_times = []
    return MedicationScheduleRead(
        id=schedule.id,
        medication_id=schedule.medication_id,
        profile_id=schedule.profile_id,
        dose_amount=schedule.dose_amount,
        dose_method=schedule.dose_method,
        dose_timing=schedule.dose_timing,
        purpose=schedule.purpose,
        times_per_day=schedule.times_per_day,
        dose_times=dose_times,
        starts_on=schedule.starts_on,
        ends_on=schedule.ends_on,
        duration_days=schedule.duration_days,
        repeat_rule=schedule.repeat_rule,
        notify_enabled=schedule.notify_enabled,
        notification_level=schedule.notification_level,
    )
