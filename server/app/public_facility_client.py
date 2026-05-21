from datetime import datetime
from typing import Any
from xml.etree import ElementTree

import httpx

from app.config import get_settings
from app.public_api_registry import API_ENDPOINTS, ApiEndpoint
from app.schemas import FacilitySearchResult


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


def _endpoint(category: str) -> ApiEndpoint:
    endpoint_id = {
        "pharmacy": "nmc-pharmacy-location",
        "hospital": "nmc-hospital-location",
        "emergency": "nmc-emergency-location",
    }[category]
    return next(endpoint for endpoint in API_ENDPOINTS if endpoint.id == endpoint_id)


async def search_public_facilities(
    *,
    latitude: float | None,
    longitude: float | None,
    facility_type: str | None,
    page: int,
    page_size: int,
) -> list[FacilitySearchResult]:
    settings = get_settings()
    if not settings.public_data_service_key:
        raise RuntimeError("PUBLIC_DATA_SERVICE_KEY is not configured.")
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
    return sorted(results, key=lambda item: item.distance_km if item.distance_km is not None else 9999)
