from __future__ import annotations

from datetime import datetime
from math import asin, cos, radians, sin, sqrt
from typing import Any
from xml.etree import ElementTree

import httpx

from app.config import get_settings
from app.public_api_registry import API_ENDPOINTS, ApiEndpoint
from app.schemas import EmergencyRoomSearchResult, FacilitySearchResult


def _text(item: ElementTree.Element, key: str) -> str:
    node = item.find(key)
    return (node.text or "").strip() if node is not None else ""


def _float(value: str) -> float | None:
    try:
        return float(value)
    except (TypeError, ValueError):
        return None


def _distance_km(item: ElementTree.Element) -> float | None:
    distance = _float(_text(item, "distance"))
    if distance is None:
        return None
    return round(distance / 1000, 2) if distance > 50 else round(distance, 2)


def _haversine_km(lat1: float | None, lon1: float | None, lat2: float | None, lon2: float | None) -> float | None:
    if None in {lat1, lon1, lat2, lon2}:
        return None
    earth_radius_km = 6371.0
    lat_delta = radians(lat2 - lat1)
    lon_delta = radians(lon2 - lon1)
    start_lat = radians(lat1)
    end_lat = radians(lat2)
    value = sin(lat_delta / 2) ** 2 + cos(start_lat) * cos(end_lat) * sin(lon_delta / 2) ** 2
    return round(2 * earth_radius_km * asin(sqrt(value)), 2)


def _hours(item: ElementTree.Element) -> str:
    start = _text(item, "startTime") or _text(item, "dutyTime1s")
    end = _text(item, "endTime") or _text(item, "dutyTime1c")
    if start and end:
        return f"{start[:2]}:{start[2:]}~{end[:2]}:{end[2:]}"
    return "운영시간 확인 필요"


def _status(item: ElementTree.Element) -> str:
    end = _text(item, "endTime") or _text(item, "dutyTime1c")
    if not end:
        return "unknown"
    now_hm = datetime.now().strftime("%H%M")
    return "open_expected" if now_hm <= end else "closed_expected"


def _tags(kind: str, item: ElementTree.Element) -> list[str]:
    tags = ["약국"] if kind == "pharmacy" else ["병원"]
    if kind == "emergency":
        tags = ["응급"]
    if _text(item, "dutyTime7s") or _text(item, "dutyTime8s"):
        tags.append("휴일운영")
    return tags


def _int(value: str) -> int:
    try:
        return int(value)
    except (TypeError, ValueError):
        return 0


def _positive(value: str) -> bool:
    return _int(value) > 0


def _available(value: str) -> bool:
    return value.strip().upper() == "Y"


def _matches_stage1(address: str, stage1: str | None) -> bool:
    if not stage1:
        return True
    aliases = {
        "서울특별시": ("서울특별시", "서울 "),
        "부산광역시": ("부산광역시", "부산 "),
        "대구광역시": ("대구광역시", "대구 "),
        "인천광역시": ("인천광역시", "인천 "),
        "광주광역시": ("광주광역시", "광주 "),
        "대전광역시": ("대전광역시", "대전 "),
        "울산광역시": ("울산광역시", "울산 "),
        "세종특별자치시": ("세종특별자치시", "세종 "),
        "경기도": ("경기도", "경기 "),
        "강원특별자치도": ("강원특별자치도", "강원도", "강원 "),
        "충청북도": ("충청북도", "충북 "),
        "충청남도": ("충청남도", "충남 "),
        "전북특별자치도": ("전북특별자치도", "전라북도", "전북 "),
        "전라남도": ("전라남도", "전남 "),
        "경상북도": ("경상북도", "경북 "),
        "경상남도": ("경상남도", "경남 "),
        "제주특별자치도": ("제주특별자치도", "제주도", "제주 "),
    }
    return address.startswith(aliases.get(stage1, (stage1,)))


def _endpoint(category: str) -> ApiEndpoint:
    endpoint_id = {
        "pharmacy": "nmc-pharmacy-location",
        "hospital": "nmc-hospital-location",
        "emergency": "nmc-emergency-location",
    }[category]
    return next(endpoint for endpoint in API_ENDPOINTS if endpoint.id == endpoint_id)


def _list_endpoint(category: str) -> ApiEndpoint:
    endpoint_id = {
        "pharmacy": "nmc-pharmacy-list",
        "hospital": "nmc-hospital-list",
    }[category]
    return next(endpoint for endpoint in API_ENDPOINTS if endpoint.id == endpoint_id)


async def search_public_facilities(
    *,
    latitude: float | None,
    longitude: float | None,
    facility_type: str | None,
    stage1: str | None = None,
    stage2: str | None = None,
    query: str | None = None,
    page: int,
    page_size: int,
) -> list[FacilitySearchResult]:
    settings = get_settings()
    if not settings.public_data_service_key:
        raise RuntimeError("PUBLIC_DATA_SERVICE_KEY is not configured.")
    if stage1 or stage2:
        if facility_type == "emergency":
            return await _fetch_emergency_institutions_by_region(
                latitude=latitude,
                longitude=longitude,
                stage1=stage1 or "",
                stage2=stage2,
                query=query,
                page=page,
                page_size=page_size,
            )
        return await _fetch_facilities_by_region(
            latitude=latitude,
            longitude=longitude,
            facility_type=facility_type,
            stage1=stage1,
            stage2=stage2,
            query=query,
            page=page,
            page_size=page_size,
        )
    if latitude is None or longitude is None:
        raise RuntimeError("latitude and longitude are required for public facility search.")

    categories = [facility_type] if facility_type in {"pharmacy", "hospital", "emergency"} else ["pharmacy", "hospital"]
    results: list[FacilitySearchResult] = []
    async with httpx.AsyncClient(timeout=8.0) as client:
        for category in categories:
            endpoint = _endpoint(category)
            params: dict[str, Any] = {
                "serviceKey": settings.public_data_service_key,
                "WGS84_LON": longitude,
                "WGS84_LAT": latitude,
                "pageNo": page,
                "numOfRows": page_size,
            }
            response = await client.get(endpoint.url, params=params)
            response.raise_for_status()
            root = ElementTree.fromstring(response.content)
            for item in root.findall(".//item"):
                name = _text(item, "dutyName")
                if not name:
                    continue
                result = FacilitySearchResult(
                    id=_text(item, "hpid") or f"{category}-{len(results)}",
                    name=name,
                    type=category,
                    department=_text(item, "dutyDivName") or None,
                    distance_km=_distance_km(item),
                    operating_status=_status(item),
                    hours=_hours(item),
                    phone=_text(item, "dutyTel1") or _text(item, "dutyTel3"),
                    address=_text(item, "dutyAddr"),
                    latitude=_float(_text(item, "latitude") or _text(item, "wgs84Lat")),
                    longitude=_float(_text(item, "longitude") or _text(item, "wgs84Lon")),
                    last_updated=datetime.now().strftime("%Y.%m.%d"),
                    tags=_tags(category, item),
                )
                results.append(result)
    return sorted(results, key=lambda item: item.distance_km if item.distance_km is not None else 9999)[:page_size]


async def _fetch_facilities_by_region(
    *,
    latitude: float | None,
    longitude: float | None,
    facility_type: str | None,
    stage1: str | None,
    stage2: str | None,
    query: str | None,
    page: int,
    page_size: int,
) -> list[FacilitySearchResult]:
    settings = get_settings()
    if not settings.public_data_service_key:
        raise RuntimeError("PUBLIC_DATA_SERVICE_KEY is not configured.")

    categories = [facility_type] if facility_type in {"pharmacy", "hospital"} else ["pharmacy", "hospital"]
    keyword = (query or "").strip()
    results: list[FacilitySearchResult] = []
    async with httpx.AsyncClient(timeout=8.0) as client:
        for category in categories:
            endpoint = _list_endpoint(category)
            params: dict[str, Any] = {
                "serviceKey": settings.public_data_service_key,
                "pageNo": page,
                "numOfRows": page_size,
            }
            if stage1:
                params["Q0"] = stage1
            if stage2:
                params["Q1"] = stage2
            if keyword:
                params["QN"] = keyword

            response = await client.get(endpoint.url, params=params)
            response.raise_for_status()
            root = ElementTree.fromstring(response.content)
            for item in root.findall(".//item"):
                name = _text(item, "dutyName")
                address = _text(item, "dutyAddr")
                if not name:
                    continue
                if stage1 and not _matches_stage1(address, stage1):
                    continue
                if keyword and keyword not in name and keyword not in address and keyword not in _text(item, "dutyDivName"):
                    continue
                item_latitude = _float(_text(item, "latitude") or _text(item, "wgs84Lat"))
                item_longitude = _float(_text(item, "longitude") or _text(item, "wgs84Lon"))
                results.append(
                    FacilitySearchResult(
                        id=_text(item, "hpid") or _text(item, "phpid") or f"{category}-region-{len(results)}",
                        name=name,
                        type=category,
                        department=_text(item, "dutyDivName") or _text(item, "dutyEmclsName") or None,
                        distance_km=_haversine_km(latitude, longitude, item_latitude, item_longitude),
                        operating_status=_status(item),
                        hours=_hours(item),
                        phone=_text(item, "dutyTel1") or _text(item, "dutyTel3"),
                        address=address,
                        latitude=item_latitude,
                        longitude=item_longitude,
                        last_updated=datetime.now().strftime("%Y.%m.%d"),
                        tags=_tags(category, item),
                    )
                )
    return sorted(results, key=lambda item: item.distance_km if item.distance_km is not None else 9999)[:page_size]


async def search_public_emergency_rooms(
    *,
    latitude: float | None,
    longitude: float | None,
    stage1: str | None,
    stage2: str | None,
    query: str | None,
    page: int,
    page_size: int,
) -> list[EmergencyRoomSearchResult]:
    if stage1:
        location_results = await _fetch_emergency_institutions_by_region(
            latitude=latitude,
            longitude=longitude,
            stage1=stage1,
            stage2=stage2,
            query=query,
            page=page,
            page_size=max(page_size * 3, 50),
        )
    else:
        location_results = await search_public_facilities(
            latitude=latitude,
            longitude=longitude,
            facility_type="emergency",
            page=page,
            page_size=page_size,
        )
    realtime_by_hpid = await _fetch_realtime_emergency_beds(stage1=stage1, stage2=stage2, page=1, page_size=100)
    keyword = (query or "").strip()
    results: list[EmergencyRoomSearchResult] = []
    for facility in location_results:
        if not _matches_stage1(facility.address, stage1):
            continue
        if keyword and keyword not in facility.name and keyword not in facility.address:
            continue
        realtime = realtime_by_hpid.get(facility.id, {})
        emergency_general_beds = _int(realtime.get("hvec", "0"))
        pediatric_beds = _int(realtime.get("hv28", "0"))
        negative_isolation_beds = _int(realtime.get("hv29", "0"))
        general_isolation_beds = _int(realtime.get("hv30", "0"))
        emergency_icu_beds = _int(realtime.get("hv31", "0"))
        pediatric_icu_beds = _int(realtime.get("hv32", "0")) + _int(realtime.get("hv33", "0"))
        emergency_inpatient_beds = _int(realtime.get("hv36", "0"))
        pediatric_inpatient_beds = _int(realtime.get("hv37", "0"))
        delivery_room_beds = _int(realtime.get("hv42", "0"))
        trauma_resuscitation_beds = _int(realtime.get("hv60", "0"))
        trauma_care_area_beds = _int(realtime.get("hv61", "0"))
        realtime_name = realtime.get("dutyName") or realtime.get("dutyname")
        result = EmergencyRoomSearchResult(
            id=facility.id,
            name=realtime_name or facility.name,
            center_type=facility.department or "응급의료기관",
            address=facility.address,
            distance_km=facility.distance_km,
            available_beds=emergency_general_beds,
            emergency_general_beds=emergency_general_beds,
            operating_rooms=_int(realtime.get("hvoc", "0")),
            icu_beds=_int(realtime.get("hvicc", "0")),
            inpatient_beds=_int(realtime.get("hvgc", "0")),
            pediatric_beds=pediatric_beds,
            negative_isolation_beds=negative_isolation_beds,
            general_isolation_beds=general_isolation_beds,
            emergency_icu_beds=emergency_icu_beds,
            pediatric_icu_beds=pediatric_icu_beds,
            emergency_inpatient_beds=emergency_inpatient_beds,
            pediatric_inpatient_beds=pediatric_inpatient_beds,
            delivery_room_beds=delivery_room_beds,
            trauma_resuscitation_beds=trauma_resuscitation_beds,
            trauma_care_area_beds=trauma_care_area_beds,
            pediatric_emergency=pediatric_beds > 0,
            delivery_room=delivery_room_beds > 0,
            isolation_room=(negative_isolation_beds + general_isolation_beds) > 0,
            severe_care=(emergency_icu_beds + _int(realtime.get("hvicc", "0")) + _int(realtime.get("hv24", "0")) + _int(realtime.get("hv25", "0"))) > 0,
            ct_available=_available(realtime.get("hvctayn", "")) or _available(realtime.get("hv5", "")),
            mri_available=_available(realtime.get("hvmriayn", "")),
            angiography_available=_available(realtime.get("hvangioayn", "")) or _available(realtime.get("hv7", "")),
            ventilator_available=_available(realtime.get("hvventiayn", "")) or _available(realtime.get("hv10", "")),
            ambulance_available=_available(realtime.get("hvamyn", "")),
            doctor_on_duty=realtime.get("hvdnm") or None,
            emergency_direct_phone=realtime.get("hv1") or None,
            pediatric_direct_phone=realtime.get("hv12") or None,
            data_note="응급실 일반 병상(hvec), 소아(hv28), 응급실 격리(hv29/hv30), 입력일시(hvidate)는 국립중앙의료원 응급의료정보조회서비스 V4 기준입니다.",
            updated_at=realtime.get("hvidate") or facility.last_updated,
            phone=facility.phone,
            emergency_phone=realtime.get("dutyTel3") or None,
            latitude=facility.latitude,
            longitude=facility.longitude,
        )
        results.append(result)
    return sorted(results, key=lambda item: item.distance_km if item.distance_km is not None else 9999)[:page_size]


async def _fetch_emergency_institutions_by_region(
    *,
    latitude: float | None,
    longitude: float | None,
    stage1: str,
    stage2: str | None,
    query: str | None,
    page: int,
    page_size: int,
) -> list[FacilitySearchResult]:
    settings = get_settings()
    if not settings.public_data_service_key:
        raise RuntimeError("PUBLIC_DATA_SERVICE_KEY is not configured.")

    params: dict[str, Any] = {
        "serviceKey": settings.public_data_service_key,
        "Q0": stage1,
        "pageNo": page,
        "numOfRows": page_size,
    }
    if stage2:
        params["Q1"] = stage2
    if query:
        params["QN"] = query

    url = "http://apis.data.go.kr/B552657/ErmctInfoInqireService/getEgytListInfoInqire"
    async with httpx.AsyncClient(timeout=8.0) as client:
        response = await client.get(url, params=params)
        response.raise_for_status()
    root = ElementTree.fromstring(response.content)

    results: list[FacilitySearchResult] = []
    keyword = (query or "").strip()
    for item in root.findall(".//item"):
        name = _text(item, "dutyName")
        address = _text(item, "dutyAddr")
        if not name:
            continue
        if keyword and keyword not in name and keyword not in address:
            continue
        item_latitude = _float(_text(item, "wgs84Lat") or _text(item, "latitude"))
        item_longitude = _float(_text(item, "wgs84Lon") or _text(item, "longitude"))
        results.append(
            FacilitySearchResult(
                id=_text(item, "hpid") or _text(item, "phpid") or f"emergency-region-{len(results)}",
                name=name,
                type="emergency",
                department=_text(item, "dutyEmclsName") or None,
                distance_km=_haversine_km(latitude, longitude, item_latitude, item_longitude),
                operating_status="open_expected",
                hours="24시간 응급실 운영 여부는 전화 확인 권장",
                phone=_text(item, "dutyTel1") or _text(item, "dutyTel3"),
                address=address,
                latitude=item_latitude,
                longitude=item_longitude,
                last_updated=datetime.now().strftime("%Y.%m.%d"),
                tags=_tags("emergency", item),
            )
        )
    return sorted(results, key=lambda item: item.distance_km if item.distance_km is not None else 9999)[:page_size]


async def _fetch_realtime_emergency_beds(*, stage1: str | None, stage2: str | None, page: int, page_size: int) -> dict[str, dict[str, str]]:
    settings = get_settings()
    if not settings.public_data_service_key:
        raise RuntimeError("PUBLIC_DATA_SERVICE_KEY is not configured.")

    params: dict[str, Any] = {
        "serviceKey": settings.public_data_service_key,
        "pageNo": page,
        "numOfRows": page_size,
    }
    if stage1:
        params["STAGE1"] = stage1
    if stage2:
        params["STAGE2"] = stage2

    url = "http://apis.data.go.kr/B552657/ErmctInfoInqireService/getEmrrmRltmUsefulSckbdInfoInqire"
    async with httpx.AsyncClient(timeout=8.0) as client:
        response = await client.get(url, params=params)
        response.raise_for_status()
    root = ElementTree.fromstring(response.content)
    results: dict[str, dict[str, str]] = {}
    for item in root.findall(".//item"):
        hpid = _text(item, "hpid")
        if not hpid:
            continue
        results[hpid] = {child.tag: (child.text or "").strip() for child in item}
    return results

