from __future__ import annotations

import json
import re
import xml.etree.ElementTree as ET
import zipfile
from datetime import datetime
from html import unescape
from pathlib import Path
from urllib.parse import urlencode

import httpx
from sqlalchemy.orm import Session

from app.config import get_settings
from app.models import HealthInfoContent

REPO_DIR = Path(__file__).resolve().parents[2]
KDCA_LIST_XLSX = REPO_DIR / "doc" / "kdca" / "kdca_openapi_healthinfo.xlsx"
KDCA_HEADERS = {
    "Accept": "application/xml, application/json, text/xml, text/plain, */*",
    "User-Agent": "AllCareMedi/0.1 (+https://github.com/jjongsongsu-del/allcare-medi)",
}


def build_health_info_url(content_serial: str) -> str:
    settings = get_settings()
    query = urlencode({"TOKEN": settings.kdca_health_info_token, "cntntsSn": content_serial})
    return f"{settings.kdca_health_info_base_url}?{query}"


def seed_health_info_metadata(db: Session) -> int:
    rows = read_health_info_workbook(KDCA_LIST_XLSX)
    changed = 0
    for row in rows:
        content_serial = row["content_serial"]
        content = db.query(HealthInfoContent).filter(HealthInfoContent.content_serial == content_serial).first()
        if content is None:
            content = HealthInfoContent(content_serial=content_serial, title=row["title"], source_url=build_health_info_url(content_serial))
            db.add(content)
            changed += 1
        content.title = row["title"]
        content.api_enabled = row["api_enabled"]
        content.category = row["category"]
        content.category_code = row["category_code"]
        content.superclass = row["superclass"]
        content.superclass_code = row["superclass_code"]
        if not content.source_url:
            content.source_url = build_health_info_url(content_serial)
        content.updated_at = datetime.utcnow()
    db.commit()
    return changed


async def sync_health_info_details(db: Session, limit: int | None = None) -> dict[str, object]:
    query = db.query(HealthInfoContent).filter(HealthInfoContent.api_enabled.is_(True)).order_by(HealthInfoContent.id.asc())
    if limit:
        query = query.limit(limit)
    contents = query.all()
    updated = 0
    failed = 0
    samples: list[str] = []
    async with httpx.AsyncClient(timeout=12.0, follow_redirects=True, headers=KDCA_HEADERS) as client:
        for content in contents:
            try:
                response = await client.get(content.source_url)
                response.raise_for_status()
                parsed = parse_health_info_payload(response.text)
                content.raw_payload = response.text
                content.content_text = parsed["content_text"]
                content.summary = parsed["summary"]
                content.sync_status = "synced"
                content.last_synced_at = datetime.utcnow()
                content.updated_at = datetime.utcnow()
                updated += 1
            except Exception as exc:
                content.sync_status = "failed"
                content.summary = f"상세 동기화 실패: {exc}"
                if len(samples) < 5:
                    samples.append(f"{content.content_serial} {content.title}: {exc}")
                failed += 1
            db.add(content)
            if (updated + failed) % 25 == 0:
                db.commit()
    db.commit()
    result = {"total": len(contents), "updated": updated, "failed": failed}
    if samples:
        result["samples"] = samples
    return result


async def sync_single_health_info_detail(db: Session, content: HealthInfoContent) -> HealthInfoContent:
    async with httpx.AsyncClient(timeout=12.0, follow_redirects=True, headers=KDCA_HEADERS) as client:
        response = await client.get(content.source_url)
        response.raise_for_status()
    parsed = parse_health_info_payload(response.text)
    content.raw_payload = response.text
    content.content_text = parsed["content_text"]
    content.summary = parsed["summary"]
    content.sync_status = "synced"
    content.last_synced_at = datetime.utcnow()
    content.updated_at = datetime.utcnow()
    db.add(content)
    db.commit()
    db.refresh(content)
    return content


def read_health_info_workbook(path: Path) -> list[dict[str, str | bool]]:
    if not path.exists():
        return []

    with zipfile.ZipFile(path) as archive:
        shared_strings = _read_shared_strings(archive)
        workbook = ET.fromstring(archive.read("xl/workbook.xml"))
        ns = {"a": "http://schemas.openxmlformats.org/spreadsheetml/2006/main", "r": "http://schemas.openxmlformats.org/officeDocument/2006/relationships"}
        sheet_id = None
        for sheet in workbook.findall("a:sheets/a:sheet", ns):
            if sheet.attrib.get("name") == "OpenAPI_HealthInfo":
                sheet_id = sheet.attrib.get(f"{{{ns['r']}}}id")
                break
        relationships = ET.fromstring(archive.read("xl/_rels/workbook.xml.rels"))
        rel_ns = {"r": "http://schemas.openxmlformats.org/package/2006/relationships"}
        target = "worksheets/sheet1.xml"
        if sheet_id:
            for rel in relationships.findall("r:Relationship", rel_ns):
                if rel.attrib.get("Id") == sheet_id:
                    target = rel.attrib["Target"].lstrip("/")
                    break
        sheet_xml = archive.read(f"xl/{target}" if not target.startswith("xl/") else target)
        sheet = ET.fromstring(sheet_xml)
        rows = []
        for row in sheet.findall("a:sheetData/a:row", ns):
            values = [_cell_value(cell, shared_strings) for cell in row.findall("a:c", ns)]
            if not values or values[0] == "번호":
                continue
            if len(values) < 8:
                continue
            serial = _clean_number(values[1])
            title = str(values[2]).strip()
            if not serial or not title:
                continue
            rows.append({
                "content_serial": serial,
                "title": title,
                "api_enabled": str(values[3]).strip().upper() == "Y",
                "category": str(values[4]).strip(),
                "category_code": _clean_number(values[5]),
                "superclass": str(values[6]).strip(),
                "superclass_code": _clean_number(values[7]),
            })
        return rows


def parse_health_info_payload(payload: str) -> dict[str, str | None]:
    text = payload.strip()
    if not text:
        return {"summary": None, "content_text": None}
    try:
        parsed = json.loads(text)
        flattened = _flatten_json_text(parsed)
        content_text = _normalize_text(flattened)
        return {"summary": _summary(content_text), "content_text": content_text}
    except json.JSONDecodeError:
        pass
    try:
        root = ET.fromstring(text)
        flattened = " ".join((node.text or "") for node in root.iter() if node.text)
        content_text = _normalize_text(flattened)
        return {"summary": _summary(content_text), "content_text": content_text}
    except ET.ParseError:
        content_text = _normalize_text(text)
        return {"summary": _summary(content_text), "content_text": content_text}


def _read_shared_strings(archive: zipfile.ZipFile) -> list[str]:
    try:
        root = ET.fromstring(archive.read("xl/sharedStrings.xml"))
    except KeyError:
        return []
    ns = {"a": "http://schemas.openxmlformats.org/spreadsheetml/2006/main"}
    strings = []
    for item in root.findall("a:si", ns):
        parts = [node.text or "" for node in item.findall(".//a:t", ns)]
        strings.append("".join(parts))
    return strings


def _cell_value(cell: ET.Element, shared_strings: list[str]) -> str:
    ns = {"a": "http://schemas.openxmlformats.org/spreadsheetml/2006/main"}
    cell_type = cell.attrib.get("t")
    value = cell.find("a:v", ns)
    if value is None:
        inline = cell.find("a:is/a:t", ns)
        return inline.text if inline is not None and inline.text else ""
    raw = value.text or ""
    if cell_type == "s" and raw.isdigit():
        index = int(raw)
        return shared_strings[index] if index < len(shared_strings) else ""
    return raw


def _clean_number(value: object) -> str:
    text = str(value).strip()
    if text.endswith(".0"):
        return text[:-2]
    return text


def _flatten_json_text(value: object) -> str:
    if isinstance(value, dict):
        return " ".join(_flatten_json_text(item) for item in value.values())
    if isinstance(value, list):
        return " ".join(_flatten_json_text(item) for item in value)
    return "" if value is None else str(value)


def _normalize_text(value: str) -> str:
    value = unescape(value)
    value = re.sub(r"<[^>]+>", " ", value)
    value = re.sub(r"\s+", " ", value)
    return value.strip()


def _summary(value: str | None) -> str | None:
    if not value:
        return None
    return value[:280]
