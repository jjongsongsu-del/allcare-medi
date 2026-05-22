from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.db import get_db
from app.models import FamilyProfile, FavoritePlace, RecentPlace
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
        db.commit()
    return {
        "status": "accepted",
        "guestFavorites": len(payload.favorites),
        "guestRecentPlaces": len(payload.recentPlaces),
        "guestFamilyProfiles": len(payload.familyProfiles),
    }
