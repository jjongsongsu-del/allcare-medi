import { FamilyProfile } from "@/services/localUserData";
import { MedicalFacility } from "@/types/domain";

export function familyRecommendation(profile?: FamilyProfile | null) {
  const relation = profile?.relationType;
  const chronicDiseases = profile?.chronicDiseases ?? "";

  if (relation === "CHILD") {
    return {
      title: "자녀 기준 추천",
      description: "소아과, 소아응급, 문 연 약국을 우선 확인합니다.",
      chips: ["소아과", "소아응급", "문 연 약국"],
      queryHints: ["소아과", "소아응급", "해열제 정보"]
    };
  }

  if (relation === "PARENT") {
    return {
      title: "부모님 기준 추천",
      description: chronicDiseases ? `${chronicDiseases} 메모를 참고해 내과, 정형외과, 가까운 야간진료를 우선합니다.` : "내과, 정형외과, 가까운 야간진료를 우선합니다.",
      chips: ["내과", "정형외과", "야간진료", "가까운 약국"],
      queryHints: ["내과", "정형외과", "야간 약국"]
    };
  }

  if (relation === "SPOUSE") {
    return {
      title: "배우자 기준 추천",
      description: "최근 이용 기관과 가까운 병원·약국을 함께 봅니다.",
      chips: ["가까운 병원", "문 연 약국", "건강검진"],
      queryHints: ["건강검진", "내과", "약국"]
    };
  }

  return {
    title: "내 기준 추천",
    description: "현재 위치와 최근 기록을 기준으로 병원·약국을 보여줍니다.",
    chips: ["문 연 약국", "가까운 병원", "응급실"],
    queryHints: ["야간 약국", "일요일 병원", "응급실"]
  };
}

export function familyFacilityScore(facility: MedicalFacility, profile?: FamilyProfile | null) {
  let score = 0;
  const relation = profile?.relationType;
  const haystack = [facility.name, facility.department, facility.tags.join(" ")].join(" ");

  if (relation === "CHILD") {
    if (haystack.includes("소아")) score += 80;
    if (facility.type === "pharmacy" && facility.isOpen) score += 20;
  }

  if (relation === "PARENT") {
    if (haystack.includes("내과") || haystack.includes("정형")) score += 50;
    if (facility.nightCare) score += 15;
    if (facility.distanceKm <= 1) score += 15;
  }

  if (profile?.chronicDiseases && haystack.includes("내과")) score += 20;
  if (facility.operatingStatus === "open_expected") score += 10;
  return score;
}
