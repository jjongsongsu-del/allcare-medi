from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.db import get_db
from app.models import FamilyProfile
from app.schemas import FamilyProfileCreate, FamilyProfileRead

router = APIRouter(prefix="/api/family-profiles", tags=["family-profiles"])


@router.get("", response_model=list[FamilyProfileRead])
def list_family_profiles(user_id: int, db: Session = Depends(get_db)) -> list[FamilyProfileRead]:
    profiles = db.query(FamilyProfile).filter(FamilyProfile.user_id == user_id).order_by(FamilyProfile.id.asc()).all()
    return [_read(profile) for profile in profiles]


@router.post("", response_model=FamilyProfileRead)
def create_family_profile(payload: FamilyProfileCreate, user_id: int, db: Session = Depends(get_db)) -> FamilyProfileRead:
    has_profile = db.query(FamilyProfile).filter(FamilyProfile.user_id == user_id).first() is not None
    profile = FamilyProfile(
        user_id=user_id,
        profile_name=payload.profileName,
        relation_type=payload.relationType,
        birth_date=payload.birthDate,
        birth_year=payload.birthYear,
        birth_month=payload.birthMonth,
        gender=payload.gender,
        phone=payload.phone,
        memo=payload.memo,
        is_default=not has_profile,
        blood_type=payload.bloodType,
        allergies=payload.allergies,
        chronic_diseases=payload.chronicDiseases,
        current_medications=payload.currentMedications,
        emergency_contact=payload.emergencyContact,
        favorite_hospital=payload.favoriteHospital,
        favorite_pharmacy=payload.favoritePharmacy,
        can_view=payload.canView,
        can_edit=payload.canEdit,
        can_receive_alert=payload.canReceiveAlert,
        can_view_emergency=payload.canViewEmergency,
        consent_status="LOCAL_ONLY" if payload.relationType in {"SELF", "CHILD"} else "PENDING",
    )
    db.add(profile)
    db.commit()
    db.refresh(profile)
    return _read(profile)


def _read(profile: FamilyProfile) -> FamilyProfileRead:
    return FamilyProfileRead(
        profileId=profile.id,
        profileName=profile.profile_name,
        relationType=profile.relation_type,
        birthDate=profile.birth_date,
        birthYear=profile.birth_year,
        birthMonth=profile.birth_month,
        gender=profile.gender,
        phone=profile.phone,
        memo=profile.memo,
        isDefault=profile.is_default,
        bloodType=profile.blood_type,
        allergies=profile.allergies,
        chronicDiseases=profile.chronic_diseases,
        currentMedications=profile.current_medications,
        emergencyContact=profile.emergency_contact,
        favoriteHospital=profile.favorite_hospital,
        favoritePharmacy=profile.favorite_pharmacy,
        canView=profile.can_view,
        canEdit=profile.can_edit,
        canReceiveAlert=profile.can_receive_alert,
        canViewEmergency=profile.can_view_emergency,
        consentStatus=profile.consent_status,
    )
