from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.db import get_db
from app.models import EmergencyShare
from app.public_facility_client import search_public_emergency_rooms
from app.schemas import EmergencyRoomSearchResponse, EmergencyShareCreate, EmergencyShareRead

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
        raise HTTPException(status_code=502, detail=f"응급실 공공 API 호출에 실패했습니다. {exc}") from exc


@router.post("/shares", response_model=EmergencyShareRead)
def create_emergency_share(payload: EmergencyShareCreate, db: Session = Depends(get_db)) -> EmergencyShareRead:
    share = EmergencyShare(
        user_id=payload.user_id,
        profile_id=payload.profile_id,
        profile_name=payload.profile_name,
        guardian_contact=payload.guardian_contact,
        room_id=payload.room_id,
        room_name=payload.room_name,
        room_phone=payload.room_phone,
        latitude=str(payload.latitude) if payload.latitude is not None else None,
        longitude=str(payload.longitude) if payload.longitude is not None else None,
        message=payload.message,
    )
    db.add(share)
    db.commit()
    db.refresh(share)
    return emergency_share_to_read(share)


def emergency_share_to_read(share: EmergencyShare) -> EmergencyShareRead:
    return EmergencyShareRead(
        id=share.id,
        user_id=share.user_id,
        profile_id=share.profile_id,
        profile_name=share.profile_name,
        guardian_contact=share.guardian_contact,
        room_id=share.room_id,
        room_name=share.room_name,
        room_phone=share.room_phone,
        latitude=parse_float(share.latitude),
        longitude=parse_float(share.longitude),
        message=share.message,
    )


def parse_float(value: str | None) -> float | None:
    if value is None:
        return None
    try:
        return float(value)
    except ValueError:
        return None

