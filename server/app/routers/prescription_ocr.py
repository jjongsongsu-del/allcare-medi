import base64
import re
import uuid
from datetime import datetime

import httpx
from fastapi import APIRouter, File, UploadFile

from app.config import get_settings
from app.schemas import PrescriptionOcrMedicineRead, PrescriptionOcrRead

router = APIRouter(prefix="/prescriptions", tags=["prescriptions"])


@router.post("/ocr", response_model=PrescriptionOcrRead)
async def recognize_prescription(file: UploadFile = File(...)) -> PrescriptionOcrRead:
    image_bytes = await file.read()
    settings = get_settings()
    raw_text = ""
    provider = "not_configured"
    message: str | None = None

    if settings.prescription_ocr_api_url and settings.prescription_ocr_api_key:
      provider = settings.prescription_ocr_provider or "clova"
      raw_text = await call_ocr_provider(
          provider=provider,
          api_url=settings.prescription_ocr_api_url,
          api_key=settings.prescription_ocr_api_key,
          image_bytes=image_bytes,
          filename=file.filename or "prescription.jpg",
          content_type=file.content_type or "image/jpeg",
      )
      if not raw_text:
          message = "OCR 공급자 응답에서 텍스트를 찾지 못했습니다. 이미지를 다시 촬영하거나 직접 입력해 주세요."
    else:
      message = "처방전 OCR 공급자 키가 설정되지 않았습니다. PRESCRIPTION_OCR_API_URL/PRESCRIPTION_OCR_API_KEY 설정 후 실제 OCR이 실행됩니다."

    medicines = parse_prescription_text(raw_text)
    return PrescriptionOcrRead(
        provider=provider,
        raw_text=raw_text,
        common=parse_common_fields(raw_text),
        medicines=medicines,
        message=message,
    )


async def call_ocr_provider(
    provider: str,
    api_url: str,
    api_key: str,
    image_bytes: bytes,
    filename: str,
    content_type: str,
) -> str:
    if provider.lower() in {"clova", "naver", "naver_clova"}:
        payload = {
            "version": "V2",
            "requestId": str(uuid.uuid4()),
            "timestamp": int(datetime.now().timestamp() * 1000),
            "images": [
                {
                    "format": filename.rsplit(".", 1)[-1].lower() if "." in filename else "jpg",
                    "name": filename,
                    "data": base64.b64encode(image_bytes).decode("ascii"),
                }
            ],
        }
        async with httpx.AsyncClient(timeout=20.0) as client:
            response = await client.post(api_url, headers={"X-OCR-SECRET": api_key}, json=payload)
            response.raise_for_status()
            data = response.json()
        fields = data.get("images", [{}])[0].get("fields", [])
        return "\n".join(str(field.get("inferText") or "").strip() for field in fields if field.get("inferText")).strip()

    async with httpx.AsyncClient(timeout=20.0) as client:
        response = await client.post(
            api_url,
            headers={"Authorization": f"Bearer {api_key}"},
            files={"file": (filename, image_bytes, content_type)},
        )
        response.raise_for_status()
        data = response.json()
    return str(data.get("text") or data.get("raw_text") or data.get("rawText") or "").strip()


def parse_common_fields(text: str) -> dict[str, str | None]:
    return {
        "patientName": find_first(text, [r"환자\s*성명\s*[:：]?\s*([가-힣A-Za-z]{2,20})", r"성명\s*[:：]?\s*([가-힣A-Za-z]{2,20})"]),
        "prescribedOn": find_first(text, [r"(\d{4}[-./]\d{1,2}[-./]\d{1,2})", r"(\d{4}년\s*\d{1,2}월\s*\d{1,2}일)"]),
        "hospitalName": find_first(text, [r"의료기관\s*[:：]?\s*([^\n]{2,40})", r"병원\s*[:：]?\s*([^\n]{2,40})"]),
        "doctorName": find_first(text, [r"의사\s*[:：]?\s*([가-힣A-Za-z]{2,20})", r"처방의\s*[:：]?\s*([가-힣A-Za-z]{2,20})"]),
    }


def parse_prescription_text(text: str) -> list[PrescriptionOcrMedicineRead]:
    if not text.strip():
        return []

    lines = [clean_line(line) for line in text.splitlines()]
    lines = [line for line in lines if line]
    medicine_lines = [line for line in lines if looks_like_medicine_line(line)]

    medicines: list[PrescriptionOcrMedicineRead] = []
    for line in medicine_lines:
        name = extract_medicine_name(line)
        if not name:
            continue
        dosage = find_first(line, [r"(\d+(?:\.\d+)?\s*(?:정|캡슐|포|mL|ml|mg|밀리그램|회분))"])
        duration = find_duration_days(line)
        times = find_first(line, [r"1\s*일\s*(\d+)\s*회", r"하루\s*(\d+)\s*회"])
        timing = infer_timing(line)
        medicines.append(
            PrescriptionOcrMedicineRead(
                name=name,
                dosage=dosage or "1정",
                form=infer_form(name),
                purpose=None,
                usage=line,
                timing=timing,
                times_per_day=int(times) if times else infer_times_per_day(line),
                dose_times=infer_dose_times(line, int(times) if times else infer_times_per_day(line)),
                duration_days=duration,
                memo=line,
                confidence=0.74,
            )
        )

    return dedupe_medicines(medicines)[:12]


def clean_line(line: str) -> str:
    return re.sub(r"\s+", " ", line.replace("|", " ")).strip()


def looks_like_medicine_line(line: str) -> bool:
    if len(line) < 3:
        return False
    has_medicine_token = bool(re.search(r"(정|캡슐|캅셀|시럽|산|액|크림|연고|패취|주|mg|밀리그램)", line, re.IGNORECASE))
    has_dose_token = bool(re.search(r"(1\s*일|하루|식전|식후|취침|아침|점심|저녁|\d+\s*일|\d+\s*회)", line))
    excludes = ("성명", "환자", "병원", "의사", "처방전", "조제", "보험", "교부", "전화", "주소")
    return has_medicine_token and has_dose_token and not any(token in line for token in excludes)


def extract_medicine_name(line: str) -> str | None:
    match = re.search(r"([가-힣A-Za-z0-9][가-힣A-Za-z0-9()·.+\-/ ]{1,50}?(?:정|캡슐|캅셀|시럽|산|액|크림|연고|패취|주)(?:\d+[A-Za-z가-힣]*)?)", line)
    if match:
        return match.group(1).strip()
    fallback = re.split(r"\s+(?:1\s*일|하루|식전|식후|아침|점심|저녁|\d+\s*일)", line, maxsplit=1)[0].strip()
    return fallback[:80] or None


def infer_form(name: str) -> str | None:
    for keyword, form in [
        ("캡슐", "캡슐제"),
        ("캅셀", "캡슐제"),
        ("정", "정제"),
        ("시럽", "시럽"),
        ("산", "산제"),
        ("액", "액제"),
        ("크림", "크림"),
        ("연고", "연고"),
        ("패취", "패취"),
        ("주", "주사"),
    ]:
        if keyword in name:
            return form
    return None


def infer_timing(line: str) -> str:
    for token in ("식전", "식후", "식간", "취침 전", "취침전", "필요 시", "필요시"):
        if token in line:
            return token.replace("취침전", "취침 전").replace("필요시", "필요 시")
    return "식후"


def infer_times_per_day(line: str) -> int:
    if "필요 시" in line or "필요시" in line:
        return 0
    count = sum(1 for token in ("아침", "점심", "저녁", "취침") if token in line)
    return count or 1


def infer_dose_times(line: str, times_per_day: int) -> list[str]:
    if times_per_day == 0:
        return []
    explicit = []
    for token, time in [("아침", "08:00"), ("점심", "13:00"), ("저녁", "19:00"), ("취침", "22:00")]:
        if token in line:
            explicit.append(time)
    if explicit:
        return explicit
    return ["08:00", "13:00", "19:00", "22:00"][:max(1, times_per_day)]


def find_duration_days(line: str) -> int | None:
    matches = [int(match) for match in re.findall(r"(\d+)\s*일", line)]
    if not matches:
        return None
    return matches[-1]


def find_first(text: str, patterns: list[str]) -> str | None:
    for pattern in patterns:
        match = re.search(pattern, text)
        if match:
            return match.group(1).strip()
    return None


def dedupe_medicines(medicines: list[PrescriptionOcrMedicineRead]) -> list[PrescriptionOcrMedicineRead]:
    seen: set[str] = set()
    result = []
    for medicine in medicines:
        key = medicine.name
        if key in seen:
            continue
        seen.add(key)
        result.append(medicine)
    return result
