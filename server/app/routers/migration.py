from fastapi import APIRouter

from app.schemas import GuestDataMigrationRequest

router = APIRouter(prefix="/api/migration", tags=["migration"])


@router.post("/guest-data")
def migrate_guest_data(payload: GuestDataMigrationRequest) -> dict[str, int | str]:
    return {
        "status": "accepted",
        "guestFavorites": len(payload.favorites),
        "guestRecentPlaces": len(payload.recentPlaces),
        "guestFamilyProfiles": len(payload.familyProfiles),
    }
