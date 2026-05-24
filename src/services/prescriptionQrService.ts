import { PrescriptionOcrMedicine, PrescriptionOcrResult } from "@/types/domain";

type ParsedQrObject = Record<string, unknown>;

const medicineKeys = ["medicines", "medicineList", "items", "drugs", "prescriptions"];
const nameKeys = ["name", "medicineName", "drugName", "itemName", "medication", "약명"];
const dosageKeys = ["dosage", "dose", "amount", "용량", "복용량"];
const timingKeys = ["timing", "doseTiming", "when", "복용시점"];
const usageKeys = ["usage", "instruction", "directions", "복용법"];
const durationKeys = ["durationDays", "days", "duration", "복용일수"];
const timesKeys = ["timesPerDay", "dailyTimes", "countPerDay", "복용횟수"];

export function parsePrescriptionQrPayload(payload: string): PrescriptionOcrResult {
  const rawText = payload.trim();
  const parsedObject = parseJson(rawText);
  if (parsedObject) {
    return resultFromObject(parsedObject, rawText);
  }

  const parsedUrl = parseUrlPayload(rawText);
  if (parsedUrl) {
    return resultFromObject(parsedUrl, rawText);
  }

  return resultFromText(rawText);
}

function parseJson(payload: string): ParsedQrObject | null {
  try {
    const value = JSON.parse(payload);
    return isRecord(value) ? value : null;
  } catch {
    return null;
  }
}

function parseUrlPayload(payload: string): ParsedQrObject | null {
  try {
    const url = new URL(payload);
    const params: ParsedQrObject = {};
    url.searchParams.forEach((value, key) => {
      params[key] = value;
    });
    return Object.keys(params).length ? params : null;
  } catch {
    if (!payload.includes("=")) return null;
    const params = new URLSearchParams(payload.replaceAll("\n", "&").replaceAll(";", "&"));
    const object: ParsedQrObject = {};
    params.forEach((value, key) => {
      object[key] = value;
    });
    return Object.keys(object).length ? object : null;
  }
}

function resultFromObject(object: ParsedQrObject, rawText: string): PrescriptionOcrResult {
  const medicineSource = firstArray(object, medicineKeys);
  const medicines = medicineSource.length
    ? medicineSource.map((item) => medicineFromRecord(isRecord(item) ? item : { name: String(item) }))
    : [medicineFromRecord(object)].filter((medicine) => medicine.name);

  return {
    provider: "Prescription QR",
    rawText,
    common: {
      patientName: firstString(object, ["patientName", "patient", "nameOfPatient", "환자명"]),
      prescribedOn: firstString(object, ["prescribedOn", "prescriptionDate", "date", "처방일"]),
      hospitalName: firstString(object, ["hospitalName", "hospital", "clinicName", "병원명"]),
      doctorName: firstString(object, ["doctorName", "doctor", "physician", "의사명"])
    },
    medicines,
    message: medicines.length ? null : "QR에서 약 정보를 찾지 못했습니다. 읽은 내용을 확인하고 직접 입력해 주세요."
  };
}

function resultFromText(rawText: string): PrescriptionOcrResult {
  const lines = rawText.split(/\r?\n|;/).map((line) => line.trim()).filter(Boolean);
  const fields: ParsedQrObject = {};
  for (const line of lines) {
    const [key, ...rest] = line.split(/[:=]/);
    if (!key || !rest.length) continue;
    fields[key.trim()] = rest.join(":").trim();
  }

  const medicine = medicineFromRecord(fields);
  if (medicine.name) {
    return {
      provider: "Prescription QR",
      rawText,
      common: {
        patientName: firstString(fields, ["환자명", "patientName"]),
        prescribedOn: firstString(fields, ["처방일", "date"]),
        hospitalName: firstString(fields, ["병원명", "hospitalName"]),
        doctorName: firstString(fields, ["의사명", "doctorName"])
      },
      medicines: [medicine],
      message: null
    };
  }

  const fallbackName = lines.find((line) => /정|캡슐|시럽|mg|ml/i.test(line)) ?? lines[0] ?? "";
  return {
    provider: "Prescription QR",
    rawText,
    common: {},
    medicines: fallbackName ? [{ name: fallbackName, doseTimes: [], memo: rawText, confidence: null }] : [],
    message: fallbackName ? "QR 형식이 표준화되어 있지 않아 첫 번째 약 후보만 추출했습니다." : "QR 내용을 읽었지만 약 정보를 찾지 못했습니다."
  };
}

function medicineFromRecord(record: ParsedQrObject): PrescriptionOcrMedicine {
  const timesPerDay = toNumber(firstValue(record, timesKeys));
  const durationDays = toNumber(firstValue(record, durationKeys));
  return {
    name: firstString(record, nameKeys) ?? "",
    dosage: firstString(record, dosageKeys),
    form: firstString(record, ["form", "type", "제형"]),
    purpose: firstString(record, ["purpose", "reason", "효능", "목적"]),
    usage: firstString(record, usageKeys),
    timing: firstString(record, timingKeys),
    timesPerDay: timesPerDay ?? undefined,
    doseTimes: parseDoseTimes(firstValue(record, ["doseTimes", "times", "time", "복용시간"])),
    durationDays: durationDays ?? null,
    memo: firstString(record, ["memo", "note", "description", "메모"]),
    confidence: null
  };
}

function parseDoseTimes(value: unknown): string[] {
  if (Array.isArray(value)) return value.map(String).filter(Boolean);
  if (typeof value !== "string") return [];
  return value.split(/[,/| ]/).map((item) => item.trim()).filter((item) => /^\d{1,2}:\d{2}$/.test(item));
}

function firstArray(record: ParsedQrObject, keys: string[]): unknown[] {
  for (const key of keys) {
    const value = record[key];
    if (Array.isArray(value)) return value;
    if (typeof value === "string" && value.trim().startsWith("[")) {
      const parsed = parseJson(value);
      if (Array.isArray(parsed)) return parsed;
    }
  }
  return [];
}

function firstString(record: ParsedQrObject, keys: string[]) {
  const value = firstValue(record, keys);
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function firstValue(record: ParsedQrObject, keys: string[]) {
  return keys.map((key) => record[key]).find((value) => value !== undefined && value !== null && String(value).trim() !== "");
}

function toNumber(value: unknown) {
  if (typeof value === "number") return value;
  if (typeof value !== "string") return null;
  const match = value.match(/\d+/);
  return match ? Number(match[0]) : null;
}

function isRecord(value: unknown): value is ParsedQrObject {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
