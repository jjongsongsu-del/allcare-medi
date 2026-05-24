from __future__ import annotations

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
    DurItemRead,
    DurSafetyRead,
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
        "dur_warnings": ["용량주의 가능성: 아세트아미노펜 일일 최대용량을 확인하세요."],
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
        "dur_warnings": ["효능군중복 가능성: 다른 해열진통제와 성분 중복 여부를 확인하세요."],
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
        "dur_warnings": ["노인주의/병용주의 가능성: 혈압약 병용 여부를 전문가에게 확인하세요."],
        "source": "fallback",
    },
]

DUR_SERVICE_BASE_URL = "https://apis.data.go.kr/1471000/DURPrdlstInfoService03"
DUR_OPERATIONS = {
    "병용금기": "getUsjntTabooInfoList03",
    "노인주의": "getOdsnAtentInfoList03",
    "DUR품목정보": "getDurPrdlstInfoList03",
    "특정연령대금기": "getSpcifyAgrdeTabooInfoList03",
    "용량주의": "getCpctyAtentInfoList03",
    "투여기간주의": "getMdctnPdAtentInfoList03",
    "효능군중복": "getEfcyDplctInfoList03",
    "서방정분할주의": "getSeobangjeongPartitnAtentInfoList03",
    "임부금기": "getPwnmTabooInfoList03",
}


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
    return matches[:limit]


@router.get("/dur/search", response_model=DurSafetyRead)
def search_dur_safety(query: str, limit: int = 10) -> DurSafetyRead:
    normalized = query.strip()
    if not normalized:
        return DurSafetyRead(query=query, source="empty", warnings=[], items=[])
    settings = get_settings()
    service_key = settings.public_data_service_key
    if not service_key:
        raise HTTPException(status_code=503, detail="PUBLIC_DATA_SERVICE_KEY 설정이 필요합니다.")
    items, api_error = fetch_dur_items(normalized, service_key, limit)
    if api_error:
        raise HTTPException(status_code=502, detail=f"DUR 공공 API 호출에 실패했습니다. {api_error}")
    warnings = build_dur_warnings(items)
    message = None if items else "DUR API 조회는 정상이나 조건에 맞는 품목이 없습니다."
    return DurSafetyRead(query=normalized, source="public-data", warnings=warnings, items=items, message=message)


def search_e_drug_medicines(query: str, limit: int) -> list[MedicineSearchResultRead]:
    settings = get_settings()
    service_key = settings.e_drug_api_key or settings.public_data_service_key
    if not service_key:
        raise HTTPException(status_code=503, detail="e약은요 API 인증키 설정이 필요합니다.")
    api_errors: list[str] = []
    for api_query in normalize_e_drug_queries(query):
        results, api_error = fetch_e_drug_medicines(api_query, service_key, limit, "itemName")
        if results:
            return results
        if api_error:
            api_errors.append(api_error)
    for api_query in normalize_e_drug_purpose_queries(query):
        results, api_error = fetch_e_drug_medicines(api_query, service_key, limit, "efcyQesitm")
        if results:
            return results
        if api_error:
            api_errors.append(api_error)
    if api_errors:
        raise HTTPException(status_code=502, detail=f"e약은요 공공 API 호출에 실패했습니다. {api_errors[0]}")
    return []


def fetch_dur_items(query: str, service_key: str, limit: int = 10) -> tuple[list[DurItemRead], str | None]:
    try:
        response = httpx.get(
            f"{DUR_SERVICE_BASE_URL}/getDurPrdlstInfoList03",
            params={
                "serviceKey": service_key,
                "pageNo": 1,
                "numOfRows": max(1, min(limit, 20)),
                "itemName": query,
                "type": "json",
            },
            timeout=7.0,
        )
        response.raise_for_status()
        payload = response.json()
    except httpx.HTTPError as exc:
        return [], str(exc)
    except ValueError as exc:
        return [], f"응답 JSON 해석 실패: {exc}"

    body = payload.get("body", payload.get("response", {}).get("body", {}))
    items = body.get("items", [])
    if isinstance(items, dict):
        items = items.get("item", items)
    if isinstance(items, dict):
        items = [items]
    if not isinstance(items, list):
        return [], None

    results: list[DurItemRead] = []
    for item in items:
        if not isinstance(item, dict):
            continue
        type_name = first_value(item, "TYPE_NAME", "TYPE_NAME  ", "typeName") or "DUR 주의"
        item_name = first_value(item, "ITEM_NAME", "itemName")
        if not item_name:
            continue
        results.append(
            DurItemRead(
                item_seq=first_value(item, "ITEM_SEQ", "itemSeq"),
                item_name=item_name,
                manufacturer=first_value(item, "ENTP_NAME", "entpName"),
                ingredient=first_value(item, "MATERIAL_NAME", "materialName"),
                type_code=first_value(item, "TYPE_CODE", "typeCode"),
                type_name=type_name,
                class_name=first_value(item, "CLASS_NO", "classNo"),
                storage_method=first_value(item, "STORAGE_METHOD", "storageMethod"),
                change_date=first_value(item, "CHANGE_DATE", "changeDate"),
            )
        )
    return results[:limit], None


def build_dur_warnings(items: list[DurItemRead]) -> list[str]:
    warnings: list[str] = []
    seen: set[str] = set()
    for item in items:
        type_names = [part.strip() for part in item.type_name.split(",") if part.strip()]
        for type_name in type_names or [item.type_name]:
            warning = dur_warning_text(type_name, item.item_name)
            if warning not in seen:
                seen.add(warning)
                warnings.append(warning)
    return warnings[:8]


def dur_warning_text(type_name: str, item_name: str) -> str:
    easy = {
        "병용금기": "함께 복용하면 안 되는 조합 정보가 있을 수 있습니다. 현재 복용약과 함께 전문가 확인이 필요합니다.",
        "노인주의": "고령자에게 주의가 필요한 약입니다. 부모님/노인 프로필에서는 복용 전 확인을 권장합니다.",
        "특정연령대금기": "특정 연령대에서 사용이 제한될 수 있습니다. 자녀/청소년 프로필은 연령 확인이 필요합니다.",
        "용량주의": "용량 주의 정보가 있습니다. 1회/1일 복용량과 처방 지시를 확인하세요.",
        "투여기간주의": "복용 기간 주의 정보가 있습니다. 장기 복용 전 전문가 확인이 필요합니다.",
        "효능군중복": "비슷한 효능의 약이 중복될 수 있습니다. 같은 계열 약과 함께 복용 중인지 확인하세요.",
        "서방정분할주의": "서방정은 쪼개거나 갈아 복용하면 안 될 수 있습니다. 복용 방법을 확인하세요.",
        "임부금기": "임신 중 주의가 필요한 약입니다. 임산부는 반드시 전문가에게 확인하세요.",
        "첨가제주의": "첨가제 주의 정보가 있습니다. 알레르기나 과민반응 이력이 있으면 확인하세요.",
    }
    return f"{type_name}: {easy.get(type_name, f'{item_name}에 DUR 주의 정보가 있습니다. 전문가 확인을 권장합니다.')}"


def first_value(item: dict, *keys: str) -> str | None:
    for key in keys:
        value = item.get(key)
        if value is not None and str(value).strip():
            return str(value).strip()
    return None


def normalize_e_drug_queries(query: str) -> list[str]:
    compact = re.sub(r"\s+", "", query.strip())
    aliases = {
        "tylenol": "타이레놀",
        "aspirin": "아스피린",
    }
    candidates = [query.strip(), compact, aliases.get(compact.lower(), "")]
    without_dose = re.sub(r"(\d+(?:\.\d+)?\s*(?:mg|mL|ml|밀리그램|그람|g))", "", compact, flags=re.IGNORECASE)
    candidates.append(without_dose)
    candidates.append(re.sub(r"(정|캡슐|산|시럽|액)$", "", without_dose))
    seen: set[str] = set()
    return [candidate for candidate in candidates if candidate and not (candidate in seen or seen.add(candidate))]


def normalize_e_drug_purpose_queries(query: str) -> list[str]:
    compact = re.sub(r"\s+", "", query.strip())
    aliases = {
        "혈압약": "혈압",
        "고혈압약": "혈압",
        "두통약": "두통",
        "감기약": "감기",
        "소화제": "소화",
        "진통제": "통증",
    }
    candidates = [aliases.get(compact, ""), re.sub(r"약$", "", compact), compact]
    seen: set[str] = set()
    return [candidate for candidate in candidates if len(candidate) >= 2 and not (candidate in seen or seen.add(candidate))]


def fetch_e_drug_medicines(query: str, service_key: str, limit: int, search_param: str) -> tuple[list[MedicineSearchResultRead], str | None]:
    try:
        response = httpx.get(
            "http://apis.data.go.kr/1471000/DrbEasyDrugInfoService/getDrbEasyDrugList",
            params={
                "serviceKey": service_key,
                "pageNo": 1,
                "numOfRows": max(1, min(limit, 20)),
                search_param: query,
                "type": "json",
            },
            timeout=5.0,
        )
        response.raise_for_status()
        payload = response.json()
    except httpx.HTTPError as exc:
        return [], str(exc)
    except ValueError as exc:
        return [], f"응답 JSON 해석 실패: {exc}"

    response_payload = payload.get("response", payload)
    items = response_payload.get("body", {}).get("items", [])
    if isinstance(items, dict):
        items = items.get("item", items)
    if isinstance(items, dict):
        items = [items]
    if not isinstance(items, list):
        return [], None

    results: list[MedicineSearchResultRead] = []
    for item in items:
        if not isinstance(item, dict):
            continue
        item_name = item.get("itemName")
        item_seq = str(item.get("itemSeq") or item_name or len(results))
        efficacy = plain_text(item.get("efcyQesitm"))
        warning = plain_text(item.get("atpnWarnQesitm")) or plain_text(item.get("atpnQesitm"))
        dur_items, _ = fetch_dur_items(str(item_name or query), service_key, 5)
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
                dur_warnings=build_dur_warnings(dur_items),
                source="e_drug",
            )
        )
    return results[:limit], None


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
    schedule = MedicationSchedule(
        **{
            **payload.model_dump(exclude={"dose_times", "weekdays", "month_days"}),
            "dose_times": json.dumps(payload.dose_times, ensure_ascii=False),
            "weekdays": json.dumps(payload.weekdays, ensure_ascii=False),
            "month_days": json.dumps(payload.month_days, ensure_ascii=False),
        }
    )
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
    weekdays = json_list(schedule.weekdays)
    month_days = json_list(schedule.month_days)
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
        weekdays=weekdays,
        week_interval=schedule.week_interval,
        monthly_mode=schedule.monthly_mode,
        month_days=month_days,
        monthly_week_ordinal=schedule.monthly_week_ordinal,
        monthly_weekday=schedule.monthly_weekday,
        missing_date_policy=schedule.missing_date_policy,
        interval_hours=schedule.interval_hours,
        interval_days=schedule.interval_days,
        cycle_active_days=schedule.cycle_active_days,
        cycle_rest_days=schedule.cycle_rest_days,
        max_daily_notifications=schedule.max_daily_notifications,
        relation_offset_minutes=schedule.relation_offset_minutes,
        reminder_enabled=schedule.reminder_enabled,
        reminder_interval_minutes=schedule.reminder_interval_minutes,
        reminder_max_count=schedule.reminder_max_count,
        guardian_alert_enabled=schedule.guardian_alert_enabled,
        guardian_alert_delay_minutes=schedule.guardian_alert_delay_minutes,
        paused=schedule.paused,
        pause_reason=schedule.pause_reason,
        notify_enabled=schedule.notify_enabled,
        notification_level=schedule.notification_level,
    )


def json_list(value: str | None) -> list[int]:
    if not value:
        return []
    try:
        parsed = json.loads(value)
    except json.JSONDecodeError:
        return []
    return parsed if isinstance(parsed, list) else []

