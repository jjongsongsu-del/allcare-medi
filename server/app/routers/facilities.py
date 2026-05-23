from fastapi import APIRouter, Query

from app.public_facility_client import search_public_facilities
from app.schemas import FacilitySearchResponse

router = APIRouter(prefix="/facilities", tags=["facilities"])


@router.get("/search", response_model=FacilitySearchResponse)
async def search_facilities(
    latitude: float | None = Query(default=None),
    longitude: float | None = Query(default=None),
    query: str | None = Query(default=None),
    type: str | None = Query(default=None),
    radius_km: float | None = Query(default=None, ge=0.1, le=50),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=10, ge=1, le=50),
) -> FacilitySearchResponse:
    try:
        results = await search_public_facilities(
            latitude=latitude,
            longitude=longitude,
            facility_type=type,
            page=page,
            page_size=page_size,
        )
    except Exception as exc:
        return FacilitySearchResponse(source="mock-fallback", results=[], message=str(exc))

    if query:
        results = [item for item in results if query in item.name or query in item.address or query in " ".join(item.tags)]
    if radius_km is not None:
        results = [item for item in results if item.distance_km is None or item.distance_km <= radius_km]

    return FacilitySearchResponse(source="public-data", results=results)
