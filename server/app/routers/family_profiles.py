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
        birth_year=payload.birthYear,
        birth_month=payload.birthMonth,
        gender=payload.gender,
        memo=payload.memo,
        is_default=not has_profile,
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
        birthYear=profile.birth_year,
        birthMonth=profile.birth_month,
        gender=profile.gender,
        memo=profile.memo,
        isDefault=profile.is_default,
    )
