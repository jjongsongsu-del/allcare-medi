import { healthContents } from "@/services/mockData";
import { fetchHealthContentDetail, fetchHealthContents } from "@/services/serverApi";

export async function getRecommendedHealthContents() {
  try {
    const contents = await fetchHealthContents({ limit: 6 });
    return contents.length ? contents : healthContents;
  } catch {
    return healthContents;
  }
}

export async function searchHealthContents(query: string) {
  const normalized = query.trim();
  if (!normalized) return [];
  return fetchHealthContents({ query: normalized, limit: 5 });
}

export async function getHealthContentDetail(content: { contentSerial?: string; id: string }) {
  const serial = content.contentSerial ?? content.id;
  return fetchHealthContentDetail(serial);
}
