from fastapi import APIRouter, Query

from app.public_facility_client import search_public_emergency_rooms
from app.schemas import EmergencyRoomSearchResponse

router = APIRouter(prefix="/emergency", tags=["emergency"])


@router.get("/rooms", response_model=EmergencyRoomSearchResponse)
async def search_emergency_rooms(
    latitude: float | None = Query(default=None),
    longitude: float | None = Query(default=None),
    stage1: str | None = Query(default=None),
    stage2: str | None = Query(default=None),
    query: str | None = Query(default=None),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=10, ge=1, le=50),
) -> EmergencyRoomSearchResponse:
    try:
        results = await search_public_emergency_rooms(
            latitude=latitude,
            longitude=longitude,
            stage1=stage1,
            stage2=stage2,
            query=query,
            page=page,
            page_size=page_size,
        )
        return EmergencyRoomSearchResponse(source="public-data", results=results)
    except Exception as exc:
        return EmergencyRoomSearchResponse(source="fallback", results=[], message=str(exc))
