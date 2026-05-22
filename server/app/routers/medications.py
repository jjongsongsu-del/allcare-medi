import json
import re

import httpx
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.config import get_settings
from app.db import get_db
from app.models import Medication, MedicationEvent, MedicationSchedule
from app.schemas import (
    MedicationCreate,
    MedicationEventCreate,
    MedicationEventRead,
    MedicationRead,
    MedicationScheduleCreate,
    MedicationScheduleRead,
    MedicineSearchResultRead,
)

router = APIRouter(prefix="/medications", tags=["medications"])

MEDICINE_SEARCH_FALLBACK = [
    {
        "id": "edrug-fallback-001",
        "name": "타이레놀정 500mg",
        "product_name": "타이레놀정 500mg",
        "ingredient": "아세트아미노펜",
        "manufacturer": "한국얀센",
        "dosage": "1정",
        "form": "정제",
        "color": "흰색",
        "imprint": "TYLENOL",
        "image_url": None,
        "source": "fallback",
    },
    {
        "id": "edrug-fallback-002",
        "name": "게보린정",
        "product_name": "게보린정",
        "ingredient": "아세트아미노펜/이소프로필안티피린/카페인",
        "manufacturer": "삼진제약",
        "dosage": "1정",
        "form": "정제",
        "color": "흰색",
        "imprint": "GB",
        "image_url": None,
        "source": "fallback",
    },
    {
        "id": "edrug-fallback-003",
        "name": "아모잘탄정",
        "product_name": "아모잘탄정",
        "ingredient": "암로디핀/로사르탄",
        "manufacturer": "한미약품",
        "dosage": "1정",
        "form": "정제",
        "color": "분홍색",
        "imprint": "HMP",
        "image_url": None,
        "source": "fallback",
    },
]


@router.get("", response_model=list[MedicationRead])
def list_medications(user_id: int | None = None, profile_id: int | None = None, db: Session = Depends(get_db)) -> list[Medication]:
    query = db.query(Medication)
    if user_id is not None:
        query = query.filter(Medication.user_id == user_id)
    if profile_id is not None:
        query = query.filter(Medication.profile_id == profile_id)
    return query.order_by(Medication.id.desc()).all()


@router.get("/search", response_model=list[MedicineSearchResultRead])
def search_medicines(query: str, limit: int = 10) -> list[MedicineSearchResultRead]:
    normalized = query.strip().lower()
    if not normalized:
        return []
    live_results = search_e_drug_medicines(query.strip(), limit)
    if live_results:
        return live_results
    matches = []
    for item in MEDICINE_SEARCH_FALLBACK:
        haystack = " ".join(
            str(item.get(key) or "")
            for key in ("name", "product_name", "ingredient", "manufacturer", "imprint")
        ).lower()
        if normalized in haystack:
            matches.append(MedicineSearchResultRead(**item))
    if not matches:
        matches = [MedicineSearchResultRead(**item) for item in MEDICINE_SEARCH_FALLBACK[: min(limit, 3)]]
    return matches[:limit]


def search_e_drug_medicines(query: str, limit: int) -> list[MedicineSearchResultRead]:
    settings = get_settings()
    service_key = settings.e_drug_api_key or settings.public_data_service_key
    if not service_key:
        return []
    try:
        response = httpx.get(
            "http://apis.data.go.kr/1471000/DrbEasyDrugInfoService/getDrbEasyDrugList",
            params={
                "serviceKey": service_key,
                "pageNo": 1,
                "numOfRows": max(1, min(limit, 20)),
                "itemName": query,
                "type": "json",
            },
            timeout=5.0,
        )
        response.raise_for_status()
        payload = response.json()
    except (httpx.HTTPError, ValueError):
        return []

    response_payload = payload.get("response", payload)
    items = response_payload.get("body", {}).get("items", [])
    if isinstance(items, dict):
        items = items.get("item", items)
    if isinstance(items, dict):
        items = [items]
    if not isinstance(items, list):
        return []

    results: list[MedicineSearchResultRead] = []
    for item in items:
        if not isinstance(item, dict):
            continue
        item_name = item.get("itemName")
        item_seq = str(item.get("itemSeq") or item_name or len(results))
        efficacy = plain_text(item.get("efcyQesitm"))
        warning = plain_text(item.get("atpnWarnQesitm")) or plain_text(item.get("atpnQesitm"))
        results.append(
            MedicineSearchResultRead(
                id=f"edrug-{item_seq}",
                name=item_name or "",
                product_name=item_name,
                ingredient=efficacy[:160] if efficacy else None,
                manufacturer=item.get("entpName"),
                dosage=infer_dosage(plain_text(item.get("useMethodQesitm"))),
                form=infer_form(item_name or ""),
                color=None,
                imprint=None,
                image_url=item.get("itemImage"),
                efficacy=efficacy,
                usage=plain_text(item.get("useMethodQesitm")),
                caution=warning,
                interaction=plain_text(item.get("intrcQesitm")),
                side_effects=plain_text(item.get("seQesitm")),
                storage_method=plain_text(item.get("depositMethodQesitm")),
                source="e_drug",
            )
        )
    return results[:limit]


def plain_text(value: object) -> str | None:
    if value is None:
        return None
    text = re.sub(r"<[^>]+>", " ", str(value))
    text = re.sub(r"\s+", " ", text).strip()
    return text or None


def infer_dosage(usage: str | None) -> str | None:
    if not usage:
        return None
    match = re.search(r"1회\s*([0-9]+(?:\s*~\s*[0-9]+)?)\s*(정|캡슐|포|ml|mL)", usage)
    if match:
        return f"{match.group(1).replace(' ', '')}{match.group(2)}"
    return None


def infer_form(item_name: str) -> str | None:
    form_keywords = ["정", "캡슐", "시럽", "액", "연고", "크림", "점안", "주사", "산", "과립"]
    for keyword in form_keywords:
        if keyword in item_name:
            return f"{keyword}제" if keyword in {"정", "캡슐", "산"} else keyword
    return None


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
