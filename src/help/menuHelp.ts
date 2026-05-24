import type { ImageSourcePropType } from "react-native";
import type { MaterialCommunityIcons } from "@expo/vector-icons";

export type MenuHelpSection = {
  title: string;
  body: string;
  icon: keyof typeof MaterialCommunityIcons.glyphMap;
};

export type MenuHelpContent = {
  title: string;
  subtitle: string;
  image: ImageSourcePropType;
  sections: MenuHelpSection[];
  footer: string;
  tone?: "primary" | "danger";
};

export const menuHelp = {
  home: {
    title: "홈 도움말",
    subtitle: "오늘 필요한 건강 행동을 한 화면에서 빠르게 시작합니다.",
    image: require("../../app_img/allcaremedi_ai.png"),
    sections: [
      {
        title: "건강요약",
        body: "등록약, 오늘 복약, DUR 주의를 한 줄 카드로 확인합니다.",
        icon: "view-dashboard-outline"
      },
      {
        title: "통합 검색",
        body: "야간 약국, 소아과, 혈압약, 응급실처럼 상황 중심으로 입력하면 알맞은 메뉴로 이동합니다.",
        icon: "magnify"
      },
      {
        title: "현재 가족 기준",
        body: "선택된 가족 프로필을 기준으로 복약, 병원약국, 응급카드 정보가 연결됩니다.",
        icon: "account-heart-outline"
      }
    ],
    footer: "의학적 판단이 필요한 내용은 의사 또는 약사 확인을 권장합니다."
  },
  pills: {
    title: "알약 도움말",
    subtitle: "약을 등록하고 상세 정보와 복약 스케줄까지 이어서 설정합니다.",
    image: require("../../app_img/allcaremedi_ai.png"),
    sections: [
      {
        title: "등록 방식",
        body: "직접등록, e약은요 검색등록, 처방전 OCR, AI 판독등록 중 상황에 맞는 방식을 선택합니다.",
        icon: "plus-circle-outline"
      },
      {
        title: "최종 확인",
        body: "OCR이나 AI 결과는 자동 저장하지 않고 사용자가 약명과 복용 정보를 확인한 뒤 저장합니다.",
        icon: "check-decagram-outline"
      },
      {
        title: "DUR 비교",
        body: "여러 약을 선택해 중복성분, 병용주의, 고위험 표시를 함께 확인할 수 있습니다.",
        icon: "shield-alert-outline"
      }
    ],
    footer: "약 복용 중단이나 병용 판단은 반드시 전문가와 상의하세요."
  },
  medication: {
    title: "복약 도움말",
    subtitle: "오늘 복약, 일정 등록, 알림, 리포트를 한 곳에서 관리합니다.",
    image: require("../../app_img/allcaremedi_sh.png"),
    sections: [
      {
        title: "일정 등록",
        body: "등록된 약을 선택한 뒤 매일, 요일별, 매주, 매월, 수시, 주기성 복약으로 일정을 만듭니다.",
        icon: "calendar-plus"
      },
      {
        title: "복약 확인",
        body: "각 회차에서 복약 완료, 건너뜀, 지연 복용 상태를 기록하고 이력을 남깁니다.",
        icon: "check-circle-outline"
      },
      {
        title: "리포트 저장",
        body: "선택 기간의 복약 이력을 CSV 또는 PDF로 저장해 보호자나 의료진과 공유할 수 있습니다.",
        icon: "file-chart-outline"
      }
    ],
    footer: "중요 약은 알림 강도를 높이고 보호자 알림과 함께 쓰는 것을 권장합니다."
  },
  facilities: {
    title: "병원약국 도움말",
    subtitle: "지금 갈 수 있는 병원과 약국을 공공 API와 지도 기준으로 찾습니다.",
    image: require("../../app_img/allcaremedi_hp.png"),
    sections: [
      {
        title: "지역과 위치",
        body: "지역명, 현재 위치, 지도 직접 선택을 기준으로 주변 병원과 약국을 조회합니다.",
        icon: "map-marker-radius-outline"
      },
      {
        title: "빠른 필터",
        body: "영업중, 약국, 병원, 응급, 야간, 휴일 칩으로 상황에 맞는 결과만 좁힙니다.",
        icon: "filter-variant"
      },
      {
        title: "방문 전 확인",
        body: "운영시간은 변동될 수 있으므로 전화 확인 후 길찾기를 진행하는 흐름을 권장합니다.",
        icon: "phone-check-outline"
      }
    ],
    footer: "API 연결 문제가 있으면 임시 데이터 대신 오류 안내를 표시합니다."
  },
  emergency: {
    title: "응급 도움말",
    subtitle: "응급실 위치, 실시간 병상, 응급카드를 빠르게 확인합니다.",
    image: require("../../app_img/allcaremedi_dr.png"),
    tone: "danger",
    sections: [
      {
        title: "119 우선",
        body: "생명 위험, 의식저하, 호흡곤란 등 긴급 상황은 앱 조회보다 119 신고가 먼저입니다.",
        icon: "phone-alert"
      },
      {
        title: "병상 현황",
        body: "응급실 일반, 소아응급, 분만실, 음압격리 등 가용 정보를 함께 확인합니다.",
        icon: "hospital-box-outline"
      },
      {
        title: "보호자 공유",
        body: "선택 응급실과 현재 위치를 보호자에게 공유하고, 가족 응급카드를 함께 확인합니다.",
        icon: "share-variant-outline"
      }
    ],
    footer: "응급실 운영과 수용 가능 여부는 방문 전 전화 확인이 필요합니다."
  },
  menu: {
    title: "메뉴 도움말",
    subtitle: "가족, 마이데이터, 동의관리, 저장 정보를 한 곳에서 정리합니다.",
    image: require("../../app_img/allcaremedi_sh.png"),
    sections: [
      {
        title: "마이데이터",
        body: "기본 건강정보와 응급 연락처를 등록하고 수정합니다. 비회원은 기기에 저장됩니다.",
        icon: "database-edit-outline"
      },
      {
        title: "가족 연결",
        body: "SNS 아이디로 가족 연결을 신청하고 승인 후 공유 범위에 따라 정보를 가져옵니다.",
        icon: "account-multiple-plus-outline"
      },
      {
        title: "동의관리",
        body: "약관, 개인정보, 위치, 알림, 건강 메모 저장 동의를 따로 확인하고 관리합니다.",
        icon: "shield-check-outline"
      }
    ],
    footer: "건강정보는 민감정보이므로 필요한 항목만 저장하는 흐름을 권장합니다."
  }
} satisfies Record<string, MenuHelpContent>;
