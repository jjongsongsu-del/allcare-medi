import { MedicalFacility, MedicationEvent, MedicineSchedule, RegisteredMedicine } from "@/types/domain";

const API_BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL ?? "http://localhost:8000";

export type ManagedApiEndpoint = {
  id: string;
  provider: string;
  name: string;
  category: string;
  method: string;
  url: string;
  operation: string;
  auth_type: string;
  enabled: boolean;
  doc_file: string;
  description: string;
};

export type SocialLoginResponse = {
  accessToken: string;
  refreshToken: string;
  isNewUser: boolean;
  user: {
    userId: number;
    nickname: string;
  };
};

export type FamilyProfilePayload = {
  profileName: string;
  relationType?: string | null;
  birthDate?: string | null;
  birthYear?: number | null;
  birthMonth?: number | null;
  gender?: string | null;
  phone?: string | null;
  memo?: string | null;
  bloodType?: string | null;
  allergies?: string | null;
  chronicDiseases?: string | null;
  currentMedications?: string | null;
  emergencyContact?: string | null;
  canView?: boolean;
  canEdit?: boolean;
  canReceiveAlert?: boolean;
  canViewEmergency?: boolean;
};

export type FamilyProfileResponse = FamilyProfilePayload & {
  profileId: number;
  isDefault: boolean;
};

type FacilitySearchResult = {
  id: string;
  name: string;
  type: string;
  department?: string | null;
  distance_km?: number | null;
  operating_status: "open_expected" | "closed_expected" | "unknown";
  hours: string;
  phone: string;
  address: string;
  latitude?: number | null;
  longitude?: number | null;
  last_updated?: string | null;
  tags: string[];
};

type FacilitySearchResponse = {
  source: string;
  results: FacilitySearchResult[];
  message?: string | null;
};

export async function fetchManagedApis(): Promise<ManagedApiEndpoint[]> {
  const response = await fetch(`${API_BASE_URL}/admin/apis`);
  if (!response.ok) {
    throw new Error("API 목록을 불러오지 못했습니다.");
  }
  return response.json();
}

export async function socialLogin(payload: {
  provider: "GOOGLE" | "KAKAO" | "NAVER";
  idToken: string;
  deviceUuid: string;
  pushToken?: string;
}): Promise<SocialLoginResponse> {
  const response = await fetch(`${API_BASE_URL}/api/auth/social-login`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(payload)
  });
  if (!response.ok) {
    throw new Error("로그인 서버 연결에 실패했습니다.");
  }
  return response.json();
}

export async function refreshLogin(payload: {
  refreshToken: string;
  deviceUuid: string;
}): Promise<SocialLoginResponse> {
  const response = await fetch(`${API_BASE_URL}/api/auth/refresh`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });
  if (!response.ok) {
    throw new Error("자동 로그인 갱신에 실패했습니다.");
  }
  return response.json();
}

export async function logoutFromServer(payload: { refreshToken: string; deviceUuid: string }): Promise<void> {
  await fetch(`${API_BASE_URL}/api/auth/logout`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });
}

export async function fetchFamilyProfiles(userId: number): Promise<FamilyProfileResponse[]> {
  const response = await fetch(`${API_BASE_URL}/api/family-profiles?user_id=${userId}`);
  if (!response.ok) {
    throw new Error("가족 프로필을 불러오지 못했습니다.");
  }
  return response.json();
}

export async function createFamilyProfile(userId: number, payload: FamilyProfilePayload): Promise<FamilyProfileResponse> {
  const response = await fetch(`${API_BASE_URL}/api/family-profiles?user_id=${userId}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });
  if (!response.ok) {
    throw new Error("가족 프로필 저장에 실패했습니다.");
  }
  return response.json();
}

export async function migrateGuestData(payload: {
  guestId: string;
  userId?: number;
  favorites: unknown[];
  recentPlaces: unknown[];
  familyProfiles: unknown[];
  medicines?: unknown[];
  medicineSchedules?: unknown[];
  medicationEvents?: unknown[];
}): Promise<void> {
  const response = await fetch(`${API_BASE_URL}/api/migration/guest-data`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });
  if (!response.ok) {
    throw new Error("비회원 데이터 병합에 실패했습니다.");
  }
}

export async function fetchRegisteredMedicines(params: { userId: number; profileId?: string | number | null }): Promise<RegisteredMedicine[]> {
  const url = new URL(`${API_BASE_URL}/medications`);
  url.searchParams.set("user_id", String(params.userId));
  if (params.profileId) url.searchParams.set("profile_id", String(params.profileId));
  const response = await fetch(url.toString());
  if (!response.ok) {
    throw new Error("등록 약 목록을 불러오지 못했습니다.");
  }
  const payload = await response.json();
  return payload.map(toRegisteredMedicine);
}

export async function createRegisteredMedicine(userId: number, medicine: RegisteredMedicine): Promise<RegisteredMedicine> {
  const response = await fetch(`${API_BASE_URL}/medications`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(toMedicationPayload(userId, medicine))
  });
  if (!response.ok) {
    throw new Error("등록 약 저장에 실패했습니다.");
  }
  return toRegisteredMedicine(await response.json());
}

export async function updateRegisteredMedicine(userId: number, medicine: RegisteredMedicine): Promise<RegisteredMedicine> {
  const response = await fetch(`${API_BASE_URL}/medications/${medicine.id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(toMedicationPayload(userId, medicine))
  });
  if (!response.ok) {
    throw new Error("등록 약 수정에 실패했습니다.");
  }
  return toRegisteredMedicine(await response.json());
}

export async function fetchMedicineSchedules(params: { profileId?: string | number | null; medicineId?: string | number | null }): Promise<MedicineSchedule[]> {
  const url = new URL(`${API_BASE_URL}/medications/schedules`);
  if (params.profileId) url.searchParams.set("profile_id", String(params.profileId));
  if (params.medicineId) url.searchParams.set("medication_id", String(params.medicineId));
  const response = await fetch(url.toString());
  if (!response.ok) {
    throw new Error("복약 스케줄을 불러오지 못했습니다.");
  }
  const payload = await response.json();
  return payload.map(toMedicineSchedule);
}

export async function createMedicineSchedule(schedule: MedicineSchedule): Promise<MedicineSchedule> {
  const response = await fetch(`${API_BASE_URL}/medications/schedules`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(toSchedulePayload(schedule))
  });
  if (!response.ok) {
    throw new Error("복약 스케줄 저장에 실패했습니다.");
  }
  return toMedicineSchedule(await response.json());
}

export async function createMedicationEvent(event: MedicationEvent): Promise<MedicationEvent> {
  const response = await fetch(`${API_BASE_URL}/medications/events`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(toEventPayload(event))
  });
  if (!response.ok) {
    throw new Error("복약 기록 저장에 실패했습니다.");
  }
  return toMedicationEvent(await response.json());
}

export async function searchFacilitiesFromServer(params: {
  latitude?: number;
  longitude?: number;
  query?: string;
  type?: string;
}): Promise<MedicalFacility[]> {
  const url = new URL(`${API_BASE_URL}/facilities/search`);
  if (params.latitude !== undefined) url.searchParams.set("latitude", String(params.latitude));
  if (params.longitude !== undefined) url.searchParams.set("longitude", String(params.longitude));
  if (params.query) url.searchParams.set("query", params.query);
  if (params.type) url.searchParams.set("type", params.type);

  const response = await fetch(url.toString());
  if (!response.ok) {
    throw new Error("병원·약국 검색 API 호출에 실패했습니다.");
  }

  const payload: FacilitySearchResponse = await response.json();
  if (payload.source !== "public-data" || payload.results.length === 0) {
    throw new Error(payload.message ?? "공공 API 결과가 없습니다.");
  }
  return payload.results.map(toMedicalFacility);
}

function toMedicalFacility(item: FacilitySearchResult): MedicalFacility {
  const isOpen = item.operating_status === "open_expected";
  const facilityType = item.type === "pharmacy" || item.type === "emergency" ? item.type : "hospital";
  return {
    id: item.id,
    name: item.name,
    type: facilityType,
    department: item.department ?? undefined,
    distanceKm: item.distance_km ?? 0,
    isOpen,
    hours: item.hours,
    operatingStatus: item.operating_status,
    closesAt: extractCloseTime(item.hours),
    lastUpdated: item.last_updated ?? undefined,
    holidayCare: item.tags.includes("휴일운영"),
    nightCare: item.hours.includes("22:") || item.hours.includes("23:") || item.tags.includes("24시간"),
    hasPhone: Boolean(item.phone),
    phone: item.phone,
    address: item.address,
    tags: item.tags
  };
}

function extractCloseTime(hours: string): string | undefined {
  const closeTime = hours.split("~")[1];
  return closeTime?.trim();
}

function toRegisteredMedicine(item: any): RegisteredMedicine {
  return {
    id: String(item.id),
    userId: item.user_id,
    profileId: item.profile_id,
    name: item.name,
    alias: item.alias ?? undefined,
    productName: item.product_name ?? undefined,
    ingredient: item.ingredient ?? undefined,
    manufacturer: item.manufacturer ?? undefined,
    dosage: item.dosage ?? undefined,
    form: item.form ?? undefined,
    color: item.color ?? undefined,
    imprint: item.imprint ?? undefined,
    imageUrl: item.image_url ?? undefined,
    purpose: item.purpose ?? undefined,
    takingMethod: item.taking_method ?? undefined,
    timing: item.timing ?? undefined,
    memo: item.memo ?? undefined,
    caution: item.caution ?? undefined,
    sideEffects: item.side_effects ?? undefined,
    storageMethod: item.storage_method ?? undefined,
    durWarnings: item.dur_warnings ? String(item.dur_warnings).split(",").filter(Boolean) : [],
    status: item.status ?? "taking",
    source: item.source ?? "manual",
    favorite: Boolean(item.favorite),
    highRisk: Boolean(item.high_risk),
    createdAt: item.created_at ?? new Date().toISOString(),
    updatedAt: item.updated_at ?? new Date().toISOString()
  };
}

function toMedicationPayload(userId: number, medicine: RegisteredMedicine) {
  return {
    user_id: userId,
    profile_id: numericId(medicine.profileId),
    name: medicine.name,
    alias: medicine.alias,
    product_name: medicine.productName ?? medicine.name,
    ingredient: medicine.ingredient ?? "",
    manufacturer: medicine.manufacturer,
    dosage: medicine.dosage,
    form: medicine.form,
    color: medicine.color,
    imprint: medicine.imprint,
    image_url: medicine.imageUrl,
    purpose: medicine.purpose,
    taking_method: medicine.takingMethod,
    timing: medicine.timing,
    memo: medicine.memo,
    caution: medicine.caution,
    side_effects: medicine.sideEffects,
    storage_method: medicine.storageMethod,
    dur_warnings: medicine.durWarnings?.join(","),
    status: medicine.status,
    source: medicine.source,
    favorite: medicine.favorite,
    high_risk: medicine.highRisk,
    safety_note: medicine.caution
  };
}

function toMedicineSchedule(item: any): MedicineSchedule {
  return {
    id: String(item.id),
    medicineId: String(item.medication_id),
    profileId: item.profile_id,
    doseAmount: item.dose_amount,
    doseMethod: item.dose_method,
    doseTiming: item.dose_timing,
    purpose: item.purpose,
    timesPerDay: item.times_per_day,
    doseTimes: item.dose_times ?? [],
    startDate: item.starts_on,
    endDate: item.ends_on,
    durationDays: item.duration_days,
    repeatRule: item.repeat_rule,
    notifyEnabled: item.notify_enabled,
    notificationLevel: item.notification_level,
    createdAt: item.created_at ?? new Date().toISOString(),
    updatedAt: item.updated_at ?? new Date().toISOString()
  };
}

function toSchedulePayload(schedule: MedicineSchedule) {
  return {
    medication_id: numericId(schedule.medicineId),
    profile_id: numericId(schedule.profileId),
    dose_amount: schedule.doseAmount,
    dose_method: schedule.doseMethod,
    dose_timing: schedule.doseTiming,
    purpose: schedule.purpose,
    times_per_day: schedule.timesPerDay,
    dose_times: schedule.doseTimes,
    starts_on: schedule.startDate,
    ends_on: schedule.endDate,
    duration_days: schedule.durationDays,
    repeat_rule: schedule.repeatRule,
    notify_enabled: schedule.notifyEnabled,
    notification_level: schedule.notificationLevel
  };
}

function toMedicationEvent(item: any): MedicationEvent {
  return {
    id: String(item.id),
    medicineId: String(item.medication_id),
    scheduleId: item.schedule_id ? String(item.schedule_id) : null,
    profileId: item.profile_id,
    scheduledAt: item.scheduled_at,
    status: item.status,
    takenAt: item.taken_at,
    sharedWithGuardian: item.shared_with_guardian,
    memo: item.memo
  };
}

function toEventPayload(event: MedicationEvent) {
  return {
    medication_id: numericId(event.medicineId),
    schedule_id: numericId(event.scheduleId),
    profile_id: numericId(event.profileId),
    scheduled_at: event.scheduledAt,
    status: event.status,
    taken_at: event.takenAt,
    shared_with_guardian: event.sharedWithGuardian,
    memo: event.memo
  };
}

function numericId(value?: string | number | null): number | null {
  if (value === undefined || value === null) return null;
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
}
