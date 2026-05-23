import { nearbyFacilities } from "@/services/mockData";
import { searchFacilitiesFromServer } from "@/services/serverApi";

export async function findNearbyFacilities(params?: { latitude?: number; longitude?: number; query?: string; type?: string; radiusKm?: number }) {
  try {
    return await searchFacilitiesFromServer({
      latitude: params?.latitude ?? 37.5665,
      longitude: params?.longitude ?? 126.978,
      query: params?.query,
      type: params?.type,
      radiusKm: params?.radiusKm
    });
  } catch {
    return nearbyFacilities;
  }
}
