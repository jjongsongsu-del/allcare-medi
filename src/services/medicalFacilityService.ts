import { nearbyFacilities } from "@/services/mockData";
import { searchFacilitiesFromServer } from "@/services/serverApi";

export async function findNearbyFacilities(params?: {
  latitude?: number;
  longitude?: number;
  query?: string;
  type?: string;
  stage1?: string;
  stage2?: string;
  radiusKm?: number;
}) {
  try {
    return await searchFacilitiesFromServer({
      latitude: params?.latitude ?? 37.5665,
      longitude: params?.longitude ?? 126.978,
      query: params?.query,
      type: params?.type,
      stage1: params?.stage1,
      stage2: params?.stage2,
      radiusKm: params?.radiusKm
    });
  } catch {
    return nearbyFacilities;
  }
}
