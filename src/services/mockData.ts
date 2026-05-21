import { EmergencyRoom, HealthContent, MedicalFacility, MedicationSchedule, Pill } from "@/types/domain";

export const recognizedPills: Pill[] = [
  {
    id: "pill-001",
    productName: "타이레놀정 500mg",
    manufacturer: "한국얀센",
    ingredient: "아세트아미노펜",
    shape: "원형 정제",
    color: "흰색",
    imprint: "TYLENOL 500",
    confidence: 0.94,
    warnings: ["간질환이 있거나 음주 후 복용 시 전문가 상담이 필요합니다."]
  },
  {
    id: "pill-002",
    productName: "아모잘탄정",
    manufacturer: "한미약품",
    ingredient: "암로디핀/로사르탄",
    shape: "타원형 정제",
    color: "분홍색",
    imprint: "AML",
    confidence: 0.87,
    warnings: ["임부 또는 임신 가능성이 있는 경우 복용 전 확인이 필요합니다."]
  }
];

export const nearbyFacilities: MedicalFacility[] = [
  {
    id: "facility-001",
    name: "올케어온누리약국",
    type: "pharmacy",
    distanceKm: 0.4,
    isOpen: true,
    hours: "오늘 22:00까지",
    phone: "02-123-4567",
    address: "서울특별시 중구 세종대로 110",
    tags: ["야간운영", "처방조제"]
  },
  {
    id: "facility-002",
    name: "서울가정의학과의원",
    type: "clinic",
    department: "가정의학과",
    distanceKm: 0.8,
    isOpen: true,
    hours: "오늘 18:30까지",
    phone: "02-987-6543",
    address: "서울특별시 중구 무교로 21",
    tags: ["소아진료", "만성질환"]
  }
];

export const healthContents: HealthContent[] = [
  {
    id: "content-001",
    title: "고혈압을 생활 속에서 관리하는 법",
    category: "순환기",
    lifeStage: "성인·노인",
    summary: "혈압 측정, 저염식, 꾸준한 운동, 복약 지속성이 핵심입니다."
  },
  {
    id: "content-002",
    title: "환절기 호흡기 감염 예방",
    category: "호흡기",
    lifeStage: "전 연령",
    summary: "손 위생, 실내 환기, 백신 접종, 증상 발생 시 조기 진료를 안내합니다."
  }
];

export const medicationSchedules: MedicationSchedule[] = [
  {
    id: "med-001",
    pillName: "혈압약",
    time: "08:00",
    instruction: "아침 식후 1정",
    adherenceRate: 92,
    familyShared: true
  },
  {
    id: "med-002",
    pillName: "비타민 D",
    time: "21:00",
    instruction: "저녁 식후 1캡슐",
    adherenceRate: 76,
    familyShared: false
  }
];

export const emergencyRooms: EmergencyRoom[] = [
  {
    id: "er-001",
    name: "서울권역응급의료센터",
    distanceKm: 2.1,
    availableBeds: 6,
    pediatricEmergency: true,
    deliveryRoom: true,
    isolationRoom: true,
    phone: "02-119-0001"
  },
  {
    id: "er-002",
    name: "도심응급의료기관",
    distanceKm: 3.8,
    availableBeds: 2,
    pediatricEmergency: false,
    deliveryRoom: false,
    isolationRoom: true,
    phone: "02-119-0002"
  }
];
