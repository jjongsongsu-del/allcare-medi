import { EmergencyRoom, MedicalFacility, MedicationEvent, MedicineSchedule, MedicineSearchResult, PrescriptionOcrResult, RegisteredMedicine } from "@/types/domain";
import { StoredPlace } from "@/services/localUserData";

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
  favoriteHospital?: string | null;
  favoritePharmacy?: string | null;
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

type EmergencyRoomSearchResult = {
  id: string;
  name: string;
  center_type: string;
  address: string;
  distance_km?: number | null;
  available_beds: number;
  emergency_general_beds: number;
  operating_rooms: number;
  icu_beds: number;
  inpatient_beds: number;
  pediatric_beds: number;
  negative_isolation_beds: number;
  general_isolation_beds: number;
  emergency_icu_beds: number;
  pediatric_icu_beds: number;
  emergency_inpatient_beds: number;
  pediatric_inpatient_beds: number;
  delivery_room_beds: number;
  trauma_resuscitation_beds: number;
  trauma_care_area_beds: number;
  pediatric_emergency: boolean;
  delivery_room: boolean;
  isolation_room: boolean;
  severe_care: boolean;
  ct_available: boolean;
  mri_available: boolean;
  angiography_available: boolean;
  ventilator_available: boolean;
  ambulance_available: boolean;
  doctor_on_duty?: string | null;
  emergency_direct_phone?: string | null;
  pediatric_direct_phone?: string | null;
  data_note: string;
  updated_at?: string | null;
  phone: string;
  emergency_phone?: string | null;
  latitude?: number | null;
  longitude?: number | null;
};

type EmergencyRoomSearchResponse = {
  source: string;
  results: EmergencyRoomSearchResult[];
  message?: string | null;
};

export type FacilityReport = {
  id: number;
  facilityExternalId: string;
  facilityName: string;
  reportType: string;
  description?: string | null;
  reporterContact?: string | null;
  status: "pending" | "reviewing" | "approved" | "rejected";
};

export type DurSafetyResult = {
  query: string;
  source: string;
  warnings: string[];
  items: Array<{
    itemSeq?: string | null;
    itemName: string;
    manufacturer?: string | null;
    ingredient?: string | null;
    typeCode?: string | null;
    typeName: string;
    className?: string | null;
    storageMethod?: string | null;
    changeDate?: string | null;
  }>;
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

export async function updateFamilyProfile(userId: number, profileId: string | number, payload: FamilyProfilePayload): Promise<FamilyProfileResponse> {
  const response = await fetch(`${API_BASE_URL}/api/family-profiles/${profileId}?user_id=${userId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });
  if (!response.ok) {
    throw new Error("가족 프로필 수정에 실패했습니다.");
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

export async function searchMedicines(query: string): Promise<MedicineSearchResult[]> {
  const url = new URL(`${API_BASE_URL}/medications/search`);
  url.searchParams.set("query", query);
  const response = await fetch(url.toString());
  if (!response.ok) {
    throw new Error("약 검색에 실패했습니다.");
  }
  const payload = await response.json();
  return payload.map(toMedicineSearchResult);
}

export async function searchDurSafety(query: string): Promise<DurSafetyResult> {
  const url = new URL(`${API_BASE_URL}/medications/dur/search`);
  url.searchParams.set("query", query);
  const response = await fetch(url.toString());
  if (!response.ok) {
    throw new Error("DUR 안전정보 조회에 실패했습니다.");
  }
  return toDurSafetyResult(await response.json());
}

export async function uploadPrescriptionOcr(imageUri: string): Promise<PrescriptionOcrResult> {
  const formData = new FormData();
  formData.append("file", {
    uri: imageUri,
    name: `prescription-${Date.now()}.jpg`,
    type: "image/jpeg"
  } as unknown as Blob);

  const response = await fetch(`${API_BASE_URL}/prescriptions/ocr`, {
    method: "POST",
    body: formData
  });
  if (!response.ok) {
    throw new Error("처방전 OCR 인식에 실패했습니다.");
  }
  return toPrescriptionOcrResult(await response.json());
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
  stage1?: string;
  stage2?: string;
  radiusKm?: number;
}): Promise<MedicalFacility[]> {
  const url = new URL(`${API_BASE_URL}/facilities/search`);
  if (params.latitude !== undefined) url.searchParams.set("latitude", String(params.latitude));
  if (params.longitude !== undefined) url.searchParams.set("longitude", String(params.longitude));
  if (params.query) url.searchParams.set("query", params.query);
  if (params.type) url.searchParams.set("type", params.type);
  if (params.stage1) url.searchParams.set("stage1", params.stage1);
  if (params.stage2) url.searchParams.set("stage2", params.stage2);
  if (params.radiusKm !== undefined) url.searchParams.set("radius_km", String(params.radiusKm));

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

export async function searchEmergencyRoomsFromServer(params: {
  latitude?: number;
  longitude?: number;
  stage1?: string;
  stage2?: string;
  query?: string;
}): Promise<EmergencyRoom[]> {
  const url = new URL(`${API_BASE_URL}/emergency/rooms`);
  if (params.latitude !== undefined) url.searchParams.set("latitude", String(params.latitude));
  if (params.longitude !== undefined) url.searchParams.set("longitude", String(params.longitude));
  if (params.stage1) url.searchParams.set("stage1", params.stage1);
  if (params.stage2) url.searchParams.set("stage2", params.stage2);
  if (params.query) url.searchParams.set("query", params.query);

  const response = await fetch(url.toString());
  if (!response.ok) {
    throw new Error("응급실 API 호출에 실패했습니다.");
  }

  const payload: EmergencyRoomSearchResponse = await response.json();
  if (payload.source !== "public-data" || payload.results.length === 0) {
    throw new Error(payload.message ?? "응급실 API 결과가 없습니다.");
  }
  return payload.results.map(toEmergencyRoom);
}

export async function createEmergencyShare(payload: {
  userId?: number | null;
  profileId?: string | number | null;
  profileName?: string | null;
  guardianContact?: string | null;
  roomId: string;
  roomName: string;
  roomPhone?: string | null;
  latitude?: number;
  longitude?: number;
  message: string;
}): Promise<void> {
  const response = await fetch(`${API_BASE_URL}/emergency/shares`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      user_id: payload.userId,
      profile_id: numericId(payload.profileId),
      profile_name: payload.profileName,
      guardian_contact: payload.guardianContact,
      room_id: payload.roomId,
      room_name: payload.roomName,
      room_phone: payload.roomPhone,
      latitude: payload.latitude,
      longitude: payload.longitude,
      message: payload.message
    })
  });
  if (!response.ok) {
    throw new Error("보호자 위치 공유 기록 저장에 실패했습니다.");
  }
}

export async function fetchFavoritePlaces(userId: number): Promise<StoredPlace[]> {
  const response = await fetch(`${API_BASE_URL}/places/favorites?user_id=${userId}`);
  if (!response.ok) {
    throw new Error("즐겨찾기를 불러오지 못했습니다.");
  }
  const payload = await response.json();
  return payload.map(toStoredPlace);
}

export async function saveFavoritePlaceToServer(userId: number, place: StoredPlace): Promise<StoredPlace> {
  const response = await fetch(`${API_BASE_URL}/places/favorites`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(toStoredPlacePayload(userId, place))
  });
  if (!response.ok) {
    throw new Error("즐겨찾기 서버 저장에 실패했습니다.");
  }
  return toStoredPlace(await response.json());
}

export async function removeFavoritePlaceFromServer(userId: number, placeId: string): Promise<void> {
  const response = await fetch(`${API_BASE_URL}/places/favorites/${encodeURIComponent(placeId)}?user_id=${userId}`, {
    method: "DELETE"
  });
  if (!response.ok && response.status !== 404) {
    throw new Error("즐겨찾기 서버 삭제에 실패했습니다.");
  }
}

export async function fetchRecentPlaces(userId: number): Promise<StoredPlace[]> {
  const response = await fetch(`${API_BASE_URL}/places/recent?user_id=${userId}`);
  if (!response.ok) {
    throw new Error("최근 본 장소를 불러오지 못했습니다.");
  }
  const payload = await response.json();
  return payload.map(toStoredPlace);
}

export async function saveRecentPlaceToServer(userId: number, place: StoredPlace): Promise<StoredPlace> {
  const response = await fetch(`${API_BASE_URL}/places/recent`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(toStoredPlacePayload(userId, place))
  });
  if (!response.ok) {
    throw new Error("최근 본 장소 서버 저장에 실패했습니다.");
  }
  return toStoredPlace(await response.json());
}

export async function createFacilityReport(payload: {
  facilityExternalId: string;
  facilityName: string;
  reportType: string;
  description?: string;
  reporterContact?: string;
}): Promise<FacilityReport> {
  const response = await fetch(`${API_BASE_URL}/facility-reports`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      facility_external_id: payload.facilityExternalId,
      facility_name: payload.facilityName,
      report_type: payload.reportType,
      description: payload.description,
      reporter_contact: payload.reporterContact
    })
  });
  if (!response.ok) {
    throw new Error("정보 오류 신고 저장에 실패했습니다.");
  }
  return toFacilityReport(await response.json());
}

export async function fetchFacilityReports(): Promise<FacilityReport[]> {
  const response = await fetch(`${API_BASE_URL}/facility-reports`);
  if (!response.ok) {
    throw new Error("정보 오류 신고 목록을 불러오지 못했습니다.");
  }
  const payload = await response.json();
  return payload.map(toFacilityReport);
}

export async function updateFacilityReportStatus(reportId: number, status: FacilityReport["status"]): Promise<FacilityReport> {
  const response = await fetch(`${API_BASE_URL}/facility-reports/${reportId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ status })
  });
  if (!response.ok) {
    throw new Error("정보 오류 신고 상태 변경에 실패했습니다.");
  }
  return toFacilityReport(await response.json());
}

function toEmergencyRoom(item: EmergencyRoomSearchResult): EmergencyRoom {
  return {
    id: item.id,
    name: item.name,
    centerType: item.center_type,
    address: item.address,
    distanceKm: item.distance_km ?? 0,
    availableBeds: item.available_beds,
    emergencyGeneralBeds: item.emergency_general_beds ?? item.available_beds,
    operatingRooms: item.operating_rooms,
    icuBeds: item.icu_beds,
    inpatientBeds: item.inpatient_beds,
    pediatricBeds: item.pediatric_beds ?? 0,
    negativeIsolationBeds: item.negative_isolation_beds ?? 0,
    generalIsolationBeds: item.general_isolation_beds ?? 0,
    emergencyIcuBeds: item.emergency_icu_beds ?? 0,
    pediatricIcuBeds: item.pediatric_icu_beds ?? 0,
    emergencyInpatientBeds: item.emergency_inpatient_beds ?? 0,
    pediatricInpatientBeds: item.pediatric_inpatient_beds ?? 0,
    deliveryRoomBeds: item.delivery_room_beds ?? 0,
    traumaResuscitationBeds: item.trauma_resuscitation_beds ?? 0,
    traumaCareAreaBeds: item.trauma_care_area_beds ?? 0,
    pediatricEmergency: item.pediatric_emergency,
    deliveryRoom: item.delivery_room,
    isolationRoom: item.isolation_room,
    severeCare: item.severe_care,
    ctAvailable: item.ct_available ?? false,
    mriAvailable: item.mri_available ?? false,
    angiographyAvailable: item.angiography_available ?? false,
    ventilatorAvailable: item.ventilator_available ?? false,
    ambulanceAvailable: item.ambulance_available ?? false,
    doctorOnDuty: item.doctor_on_duty ?? undefined,
    emergencyDirectPhone: item.emergency_direct_phone ?? undefined,
    pediatricDirectPhone: item.pediatric_direct_phone ?? undefined,
    dataNote: item.data_note ?? "국립중앙의료원 응급의료정보조회서비스 V4 기준입니다.",
    updatedAt: item.updated_at ?? new Date().toISOString(),
    phone: item.phone,
    emergencyPhone: item.emergency_phone ?? undefined,
    latitude: item.latitude ?? undefined,
    longitude: item.longitude ?? undefined
  };
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
    latitude: item.latitude ?? undefined,
    longitude: item.longitude ?? undefined,
    tags: item.tags
  };
}

function toStoredPlace(item: any): StoredPlace {
  return {
    placeId: String(item.place_id),
    placeName: item.place_name,
    placeType: item.place_type,
    profileId: item.profile_id ?? undefined,
    address: item.address ?? "",
    phone: item.phone ?? "",
    distanceKm: item.distance_km ?? undefined,
    hours: item.hours ?? undefined,
    operatingStatus: item.operating_status ?? undefined,
    closesAt: item.closes_at ?? undefined,
    latitude: item.latitude ?? undefined,
    longitude: item.longitude ?? undefined,
    tags: Array.isArray(item.tags) ? item.tags : [],
    memo: item.memo ?? undefined,
    viewedAt: item.viewed_at ?? undefined
  };
}

function toStoredPlacePayload(userId: number, place: StoredPlace) {
  return {
    user_id: userId,
    profile_id: numericId(place.profileId),
    place_id: place.placeId,
    place_name: place.placeName,
    place_type: place.placeType,
    address: place.address,
    phone: place.phone,
    distance_km: place.distanceKm,
    hours: place.hours,
    operating_status: place.operatingStatus,
    closes_at: place.closesAt,
    latitude: place.latitude,
    longitude: place.longitude,
    tags: place.tags ?? [],
    memo: place.memo,
    viewed_at: place.viewedAt
  };
}

function toFacilityReport(item: any): FacilityReport {
  return {
    id: item.id,
    facilityExternalId: item.facility_external_id,
    facilityName: item.facility_name,
    reportType: item.report_type,
    description: item.description ?? null,
    reporterContact: item.reporter_contact ?? null,
    status: item.status
  };
}

function extractCloseTime(hours: string): string | undefined {
  const closeTime = hours.split("~")[1];
  return closeTime?.trim();
}

function toMedicineSearchResult(item: any): MedicineSearchResult {
  return {
    id: String(item.id),
    name: item.name,
    productName: item.product_name ?? undefined,
    ingredient: item.ingredient ?? undefined,
    manufacturer: item.manufacturer ?? undefined,
    dosage: item.dosage ?? undefined,
    form: item.form ?? undefined,
    color: item.color ?? undefined,
    imprint: item.imprint ?? undefined,
    imageUrl: item.image_url ?? undefined,
    efficacy: item.efficacy ?? undefined,
    usage: item.usage ?? undefined,
    caution: item.caution ?? undefined,
    interaction: item.interaction ?? undefined,
    sideEffects: item.side_effects ?? undefined,
    storageMethod: item.storage_method ?? undefined,
    durWarnings: Array.isArray(item.dur_warnings) ? item.dur_warnings : [],
    source: item.source ?? "fallback"
  };
}

function toDurSafetyResult(item: any): DurSafetyResult {
  return {
    query: item.query ?? "",
    source: item.source ?? "unknown",
    warnings: Array.isArray(item.warnings) ? item.warnings : [],
    items: Array.isArray(item.items)
      ? item.items.map((row: any) => ({
          itemSeq: row.item_seq ?? null,
          itemName: row.item_name,
          manufacturer: row.manufacturer ?? null,
          ingredient: row.ingredient ?? null,
          typeCode: row.type_code ?? null,
          typeName: row.type_name,
          className: row.class_name ?? null,
          storageMethod: row.storage_method ?? null,
          changeDate: row.change_date ?? null
        }))
      : [],
    message: item.message ?? null
  };
}

function toPrescriptionOcrResult(item: any): PrescriptionOcrResult {
  return {
    provider: item.provider ?? "unknown",
    rawText: item.raw_text ?? "",
    common: {
      patientName: item.common?.patientName ?? item.common?.patient_name ?? null,
      prescribedOn: item.common?.prescribedOn ?? item.common?.prescribed_on ?? null,
      hospitalName: item.common?.hospitalName ?? item.common?.hospital_name ?? null,
      doctorName: item.common?.doctorName ?? item.common?.doctor_name ?? null
    },
    medicines: Array.isArray(item.medicines)
      ? item.medicines.map((medicine: any) => ({
          name: medicine.name,
          dosage: medicine.dosage ?? undefined,
          form: medicine.form ?? undefined,
          purpose: medicine.purpose ?? undefined,
          usage: medicine.usage ?? undefined,
          timing: medicine.timing ?? undefined,
          timesPerDay: medicine.times_per_day ?? undefined,
          doseTimes: Array.isArray(medicine.dose_times) ? medicine.dose_times : [],
          durationDays: medicine.duration_days ?? null,
          memo: medicine.memo ?? undefined,
          confidence: medicine.confidence ?? null
        }))
      : [],
    message: item.message ?? null
  };
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
