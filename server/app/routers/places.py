import json

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.db import get_db
from app.models import FavoritePlace, RecentPlace
from app.schemas import StoredPlaceCreate, StoredPlaceRead

router = APIRouter(prefix="/places", tags=["places"])


@router.get("/favorites", response_model=list[StoredPlaceRead])
def list_favorites(user_id: int, db: Session = Depends(get_db)) -> list[StoredPlaceRead]:
    places = db.query(FavoritePlace).filter(FavoritePlace.user_id == user_id).order_by(FavoritePlace.id.desc()).limit(50).all()
    return [favorite_to_read(place) for place in places]


@router.post("/favorites", response_model=StoredPlaceRead)
def save_favorite(payload: StoredPlaceCreate, db: Session = Depends(get_db)) -> StoredPlaceRead:
    existing = (
        db.query(FavoritePlace)
        .filter(FavoritePlace.user_id == payload.user_id, FavoritePlace.place_id == payload.place_id)
        .first()
    )
    place = existing or FavoritePlace(user_id=payload.user_id, place_id=payload.place_id)
    apply_place_payload(place, payload)
    db.add(place)
    db.commit()
    db.refresh(place)
    return favorite_to_read(place)


@router.delete("/favorites/{place_id}")
def delete_favorite(place_id: str, user_id: int, db: Session = Depends(get_db)) -> dict[str, str]:
    deleted = db.query(FavoritePlace).filter(FavoritePlace.user_id == user_id, FavoritePlace.place_id == place_id).delete()
    db.commit()
    if deleted == 0:
        raise HTTPException(status_code=404, detail="Favorite place not found.")
    return {"status": "deleted"}


@router.get("/recent", response_model=list[StoredPlaceRead])
def list_recent_places(user_id: int, db: Session = Depends(get_db)) -> list[StoredPlaceRead]:
    places = db.query(RecentPlace).filter(RecentPlace.user_id == user_id).order_by(RecentPlace.id.desc()).limit(30).all()
    return [recent_to_read(place) for place in places]


@router.post("/recent", response_model=StoredPlaceRead)
def save_recent_place(payload: StoredPlaceCreate, db: Session = Depends(get_db)) -> StoredPlaceRead:
    db.query(RecentPlace).filter(RecentPlace.user_id == payload.user_id, RecentPlace.place_id == payload.place_id).delete()
    place = RecentPlace(user_id=payload.user_id, place_id=payload.place_id)
    apply_place_payload(place, payload)
    place.viewed_at = payload.viewed_at
    db.add(place)
    db.commit()
    db.refresh(place)
    return recent_to_read(place)


def apply_place_payload(place: FavoritePlace | RecentPlace, payload: StoredPlaceCreate) -> None:
    place.profile_id = payload.profile_id
    place.place_name = payload.place_name
    place.place_type = payload.place_type
    place.address = payload.address
    place.phone = payload.phone
    place.distance_km = str(payload.distance_km) if payload.distance_km is not None else None
    place.hours = payload.hours
    place.operating_status = payload.operating_status
    place.closes_at = payload.closes_at
    place.latitude = str(payload.latitude) if payload.latitude is not None else None
    place.longitude = str(payload.longitude) if payload.longitude is not None else None
    place.tags = json.dumps(payload.tags, ensure_ascii=False)
    if isinstance(place, FavoritePlace):
        place.memo = payload.memo


def favorite_to_read(place: FavoritePlace) -> StoredPlaceRead:
    return StoredPlaceRead(
        id=place.id,
        user_id=place.user_id,
        profile_id=place.profile_id,
        place_id=place.place_id,
        place_name=place.place_name or place.place_id,
        place_type=place.place_type,
        address=place.address,
        phone=place.phone,
        distance_km=parse_float(place.distance_km),
        hours=place.hours,
        operating_status=place.operating_status,
        closes_at=place.closes_at,
        latitude=parse_float(place.latitude),
        longitude=parse_float(place.longitude),
        tags=parse_tags(place.tags),
        memo=place.memo,
    )


def recent_to_read(place: RecentPlace) -> StoredPlaceRead:
    return StoredPlaceRead(
        id=place.id,
        user_id=place.user_id,
        profile_id=place.profile_id,
        place_id=place.place_id,
        place_name=place.place_name,
        place_type=place.place_type,
        address=place.address,
        phone=place.phone,
        distance_km=parse_float(place.distance_km),
        hours=place.hours,
        operating_status=place.operating_status,
        closes_at=place.closes_at,
        latitude=parse_float(place.latitude),
        longitude=parse_float(place.longitude),
        tags=parse_tags(place.tags),
        viewed_at=place.viewed_at,
    )


def parse_float(value: str | None) -> float | None:
    if value is None:
        return None
    try:
        return float(value)
    except ValueError:
        return None


def parse_tags(value: str | None) -> list[str]:
    if not value:
        return []
    try:
        parsed = json.loads(value)
        return parsed if isinstance(parsed, list) else []
    except json.JSONDecodeError:
        return []
