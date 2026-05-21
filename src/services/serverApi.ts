import { MedicalFacility } from "@/types/domain";

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
