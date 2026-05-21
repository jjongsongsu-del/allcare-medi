import { nearbyFacilities } from "@/services/mockData";
import { searchFacilitiesFromServer } from "@/services/serverApi";

export async function findNearbyFacilities(params?: { query?: string; type?: string }) {
  try {
    return await searchFacilitiesFromServer({
      latitude: 37.5665,
      longitude: 126.978,
      query: params?.query,
      type: params?.type
    });
  } catch {
    return nearbyFacilities;
  }
}
