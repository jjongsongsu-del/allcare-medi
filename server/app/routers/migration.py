import json

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.db import get_db
from app.models import FamilyProfile, FavoritePlace, Medication, MedicationEvent, MedicationSchedule, RecentPlace
from app.schemas import GuestDataMigrationRequest

router = APIRouter(prefix="/api/migration", tags=["migration"])


@router.post("/guest-data")
def migrate_guest_data(payload: GuestDataMigrationRequest, db: Session = Depends(get_db)) -> dict[str, int | str]:
    if payload.userId:
        for favorite in payload.favorites:
            db.add(
                FavoritePlace(
                    user_id=payload.userId,
                    place_id=str(favorite.get("placeId", "")),
                    place_type=str(favorite.get("placeType", "")),
                    memo=favorite.get("memo"),
                )
            )
        for recent in payload.recentPlaces:
            db.add(
                RecentPlace(
                    user_id=payload.userId,
                    place_id=str(recent.get("placeId", "")),
                    place_name=str(recent.get("placeName", "")),
                    place_type=str(recent.get("placeType", "")),
                    address=recent.get("address"),
                    phone=recent.get("phone"),
                    viewed_at=recent.get("viewedAt"),
                )
            )
        for profile in payload.familyProfiles:
            db.add(
                FamilyProfile(
                    user_id=payload.userId,
                    profile_name=str(profile.get("profileName", "가족")),
                    relation_type=profile.get("relationType"),
                    birth_year=profile.get("birthYear"),
                    birth_month=profile.get("birthMonth"),
                    gender=profile.get("gender"),
                    memo=profile.get("memo"),
                    is_default=False,
                )
            )
        medication_id_map: dict[str, int] = {}
        schedule_id_map: dict[str, int] = {}
        for medicine in payload.medicines:
            medication = Medication(
                user_id=payload.userId,
                profile_id=coerce_int(medicine.get("profileId")),
                name=str(medicine.get("name") or medicine.get("productName") or ""),
                alias=medicine.get("alias"),
                product_name=medicine.get("productName") or medicine.get("name"),
                ingredient=medicine.get("ingredient") or "",
                manufacturer=medicine.get("manufacturer"),
                dosage=medicine.get("dosage"),
                form=medicine.get("form"),
                color=medicine.get("color"),
                imprint=medicine.get("imprint"),
                purpose=medicine.get("purpose"),
                taking_method=medicine.get("takingMethod"),
                timing=medicine.get("timing"),
                memo=medicine.get("memo"),
                dur_warnings=",".join(medicine.get("durWarnings", [])),
                status=medicine.get("status", "taking"),
                source=medicine.get("source", "manual"),
                favorite=bool(medicine.get("favorite", False)),
                high_risk=bool(medicine.get("highRisk", False)),
            )
            db.add(medication)
            db.flush()
            medication_id_map[str(medicine.get("id"))] = medication.id
        for schedule in payload.medicineSchedules:
            medication_id = medication_id_map.get(str(schedule.get("medicineId"))) or coerce_int(schedule.get("medicineId"))
            if medication_id is None:
                continue
            medication_schedule = MedicationSchedule(
                medication_id=medication_id,
                profile_id=coerce_int(schedule.get("profileId")),
                dose_amount=str(schedule.get("doseAmount") or "1 tablet"),
                dose_method=str(schedule.get("doseMethod") or "oral"),
                dose_timing=str(schedule.get("doseTiming") or "after meal"),
                purpose=schedule.get("purpose"),
                times_per_day=int(schedule.get("timesPerDay") or 1),
                dose_times=json.dumps(schedule.get("doseTimes") or [], ensure_ascii=False),
                starts_on=str(schedule.get("startDate") or ""),
                ends_on=schedule.get("endDate"),
                duration_days=coerce_int(schedule.get("durationDays")),
                repeat_rule=str(schedule.get("repeatRule") or "daily"),
                notify_enabled=bool(schedule.get("notifyEnabled", True)),
                notification_level=str(schedule.get("notificationLevel") or "normal"),
            )
            db.add(medication_schedule)
            db.flush()
            schedule_id_map[str(schedule.get("id"))] = medication_schedule.id
        for event in payload.medicationEvents:
            medication_id = medication_id_map.get(str(event.get("medicineId"))) or coerce_int(event.get("medicineId"))
            if medication_id is None:
                continue
            db.add(
                MedicationEvent(
                    medication_id=medication_id,
                    schedule_id=schedule_id_map.get(str(event.get("scheduleId"))) or coerce_int(event.get("scheduleId")),
                    profile_id=coerce_int(event.get("profileId")),
                    scheduled_at=str(event.get("scheduledAt") or ""),
                    status=str(event.get("status") or "pending"),
                    taken_at=event.get("takenAt"),
                    shared_with_guardian=bool(event.get("sharedWithGuardian", False)),
                    memo=event.get("memo"),
                )
            )
        db.commit()
    return {
        "status": "accepted",
        "guestFavorites": len(payload.favorites),
        "guestRecentPlaces": len(payload.recentPlaces),
        "guestFamilyProfiles": len(payload.familyProfiles),
        "guestMedicines": len(payload.medicines),
        "guestMedicineSchedules": len(payload.medicineSchedules),
        "guestMedicationEvents": len(payload.medicationEvents),
    }


def coerce_int(value: object) -> int | None:
    try:
        return int(value) if value is not None and str(value).isdigit() else None
    except (TypeError, ValueError):
        return None
