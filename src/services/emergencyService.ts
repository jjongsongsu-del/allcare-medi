import { emergencyRooms } from "@/services/mockData";
import { searchEmergencyRoomsFromServer } from "@/services/serverApi";

export async function getNearbyEmergencyRooms(params?: {
  latitude?: number;
  longitude?: number;
  stage1?: string;
  stage2?: string;
  query?: string;
}) {
  try {
    return await searchEmergencyRoomsFromServer(params ?? {});
  } catch {
    return emergencyRooms;
  }
}
