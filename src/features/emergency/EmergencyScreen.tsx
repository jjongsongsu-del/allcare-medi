import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useEffect, useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { AppScreen } from "@/components/AppScreen";
import { CurrentFamilyBanner } from "@/components/CurrentFamilyBanner";
import { useFamilyProfile } from "@/family/FamilyProfileProvider";
import { getNearbyEmergencyRooms } from "@/services/emergencyService";
import { colors } from "@/theme/colors";
import { spacing } from "@/theme/spacing";
import { typography } from "@/theme/typography";
import { EmergencyRoom } from "@/types/domain";

const regions = ["서울", "부산", "대구", "인천", "광주", "대전", "울산", "경기도"];

export function EmergencyScreen() {
  const [emergencyRooms, setEmergencyRooms] = useState<EmergencyRoom[]>([]);
  const [selectedRegion, setSelectedRegion] = useState("서울");
  const [keyword, setKeyword] = useState("");
  const [district, setDistrict] = useState("");
  const { selectedProfile } = useFamilyProfile();

  useEffect(() => {
    getNearbyEmergencyRooms().then(setEmergencyRooms);
  }, []);

  const primaryRoom = emergencyRooms[0];
  const profileAdvice = useMemo(() => getProfileEmergencyAdvice(selectedProfile?.relationType), [selectedProfile?.relationType]);
  const emergencyNotes = [
    selectedProfile?.bloodType ? `혈액형 ${selectedProfile.bloodType}` : "혈액형 미등록",
    selectedProfile?.allergies ? `알레르기 ${selectedProfile.allergies}` : "알레르기 미등록",
    selectedProfile?.currentMedications ? `복용약 ${selectedProfile.currentMedications}` : "복용약 미등록"
  ];

  return (
    <AppScreen contentStyle={styles.screen}>
      <View style={styles.hero}>
        <View style={styles.heroHeading}>
          <View style={styles.alertIconBox}>
            <MaterialCommunityIcons name="alert" size={28} color={emergencyRed} />
          </View>
          <View style={styles.heroTitleGroup}>
            <Text style={styles.eyebrow}>응급</Text>
            <Text style={styles.title}>응급실 현황</Text>
          </View>
        </View>
        <Text style={styles.description}>
          국립중앙의료원 응급의료정보를 기준으로 주변 응급실과 실시간 가용 병상, 주요 장비 상태를 확인합니다.
        </Text>
      </View>

      <View style={styles.priorityNotice}>
        <MaterialCommunityIcons name="phone-alert" size={26} color={emergencyRed} />
        <Text style={styles.priorityText}>
          생명이 위급한 상황은 앱 확인보다 119 신고가 우선입니다. 방문 전 응급실 전화 확인을 권장합니다.
        </Text>
      </View>

      <View style={styles.searchPanel}>
        <View style={styles.searchBox}>
          <MaterialCommunityIcons name="magnify" size={22} color={mutedRed} />
          <TextInput
            value={keyword}
            onChangeText={setKeyword}
            placeholder="병원명, 지역, 중증진료 검색"
            placeholderTextColor="#B56A6A"
            style={styles.searchInput}
          />
        </View>

        <View style={styles.chipRow}>
          {regions.map((region) => (
            <Pressable
              key={region}
              onPress={() => setSelectedRegion(region)}
              style={[styles.regionChip, selectedRegion === region && styles.regionChipActive]}
            >
              <Text style={[styles.regionChipText, selectedRegion === region && styles.regionChipTextActive]}>{region}</Text>
            </Pressable>
          ))}
        </View>

        <TextInput
          value={district}
          onChangeText={setDistrict}
          placeholder="시군구 선택 입력 예: 강남구"
          placeholderTextColor="#B56A6A"
          style={styles.districtInput}
        />

        <View style={styles.actionRow}>
          <EmergencyButton label="조회" icon="clipboard-pulse-outline" variant="filled" />
          <EmergencyButton label="내 위치 기준" icon="crosshairs-gps" variant="filled" />
          <EmergencyButton label="NEMC 보기" icon="open-in-new" variant="outline" />
        </View>
        <Text style={styles.updatedText}>마지막 조회: 04:00 · 병상 수는 공공데이터 응답 기준입니다.</Text>
      </View>

      <CurrentFamilyBanner compact />

      <View style={styles.familyCard}>
        <View style={styles.cardHeader}>
          <View>
            <Text style={styles.cardEyebrow}>선택 가족 응급카드</Text>
            <Text style={styles.cardTitle}>{selectedProfile?.profileName ?? "나"} 기준 확인 정보</Text>
          </View>
          <View style={styles.familyBadge}>
            <Text style={styles.familyBadgeText}>{profileAdvice.badge}</Text>
          </View>
        </View>
        <Text style={styles.familyAdvice}>{profileAdvice.message}</Text>
        <View style={styles.noteGrid}>
          {emergencyNotes.map((note) => (
            <View key={note} style={styles.notePill}>
              <Text style={styles.noteText}>{note}</Text>
            </View>
          ))}
        </View>
        <Text style={styles.helperText}>
          보호자 연락처: {selectedProfile?.emergencyContact || selectedProfile?.phone || "미등록"} · 응급 정보는 마이페이지 가족관리에서 수정할 수 있습니다.
        </Text>
      </View>

      {emergencyRooms.map((room) => (
        <EmergencyRoomCard key={room.id} room={room} highlighted={room.id === primaryRoom?.id} />
      ))}
    </AppScreen>
  );
}

function EmergencyButton({ label, icon, variant }: { label: string; icon: keyof typeof MaterialCommunityIcons.glyphMap; variant: "filled" | "outline" }) {
  const filled = variant === "filled";
  return (
    <Pressable style={[styles.button, filled ? styles.buttonFilled : styles.buttonOutline]}>
      <MaterialCommunityIcons name={icon} size={18} color={filled ? "#FFFFFF" : emergencyRed} />
      <Text style={[styles.buttonText, filled ? styles.buttonTextFilled : styles.buttonTextOutline]}>{label}</Text>
    </Pressable>
  );
}

function EmergencyRoomCard({ room, highlighted }: { room: EmergencyRoom; highlighted: boolean }) {
  const distance = room.distanceKm < 1 ? `${Math.round(room.distanceKm * 1000)}m` : `${room.distanceKm.toFixed(1)}km`;

  return (
    <View style={[styles.roomCard, highlighted && styles.roomCardHighlighted]}>
      <View style={styles.roomTopRow}>
        <View style={styles.roomTitleArea}>
          <Text style={styles.roomName}>{room.name}</Text>
          <Text style={styles.roomMeta}>{room.centerType} · {distance}</Text>
        </View>
        <View style={styles.bedBadge}>
          <Text style={styles.bedCount}>{room.availableBeds}</Text>
          <Text style={styles.bedLabel}>응급실</Text>
        </View>
      </View>
      <Text style={styles.address}>{room.address}</Text>

      <View style={styles.metricRow}>
        <MetricBox value={room.operatingRooms} label="수술실" />
        <MetricBox value={room.icuBeds} label="중환자" />
        <MetricBox value={room.inpatientBeds} label="입원실" />
      </View>

      <View style={styles.statusRow}>
        <StatusPill label="소아응급" active={room.pediatricEmergency} />
        <StatusPill label="분만실" active={room.deliveryRoom} />
        <StatusPill label="음압격리" active={room.isolationRoom} />
        <StatusPill label="중증진료" active={room.severeCare} />
      </View>

      <Text style={styles.roomNotice}>최근 업데이트: {room.updatedAt} · 실제 수용 가능 여부는 전화 확인이 필요합니다.</Text>

      <View style={styles.roomActions}>
        <EmergencyButton label="전화" icon="phone" variant="filled" />
        <EmergencyButton label="길찾기" icon="navigation-variant" variant="outline" />
        <EmergencyButton label="보호자 공유" icon="share-variant" variant="outline" />
      </View>
    </View>
  );
}

function MetricBox({ value, label }: { value: number; label: string }) {
  return (
    <View style={styles.metricBox}>
      <Text style={styles.metricValue}>{value}</Text>
      <Text style={styles.metricLabel}>{label}</Text>
    </View>
  );
}

function StatusPill({ label, active }: { label: string; active: boolean }) {
  return (
    <View style={[styles.statusPill, active ? styles.statusPillActive : styles.statusPillInactive]}>
      <Text style={[styles.statusText, active ? styles.statusTextActive : styles.statusTextInactive]}>
        {active ? label : `${label} 확인`}
      </Text>
    </View>
  );
}

function getProfileEmergencyAdvice(relation?: string | null) {
  if (relation === "CHILD") {
    return { badge: "소아 우선", message: "자녀 프로필이 선택되어 소아응급 가능 기관을 먼저 확인하는 흐름으로 안내합니다." };
  }
  if (relation === "PARENT") {
    return { badge: "보호자 확인", message: "부모님 프로필이 선택되어 복용약, 기저질환, 보호자 연락처 확인을 우선합니다." };
  }
  if (relation === "SPOUSE") {
    return { badge: "가족 공유", message: "배우자 응급정보와 보호자 연락처를 함께 확인할 수 있습니다." };
  }
  return { badge: "본인", message: "현재 선택된 가족의 응급카드 정보를 기준으로 전화와 길찾기를 진행합니다." };
}

const emergencyRed = "#D92D20";
const emergencyDark = "#8C1D18";
const emergencySoft = "#FFF1F1";
const emergencyTint = "#FFE4E2";
const mutedRed = "#A64B45";

const styles = StyleSheet.create({
  screen: {
    backgroundColor: "#FFFFFF",
    gap: spacing.md
  },
  hero: {
    paddingTop: spacing.sm,
    gap: spacing.xs
  },
  heroHeading: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    marginBottom: spacing.xs
  },
  heroTitleGroup: {
    flex: 1,
    justifyContent: "center"
  },
  alertIconBox: {
    width: 54,
    height: 54,
    borderRadius: 8,
    backgroundColor: emergencyTint,
    alignItems: "center",
    justifyContent: "center"
  },
  eyebrow: {
    ...typography.caption,
    color: emergencyRed,
    fontWeight: "800",
    lineHeight: 22
  },
  title: {
    ...typography.title,
    color: colors.textStrong,
    lineHeight: 32
  },
  description: {
    ...typography.body,
    color: colors.text,
    lineHeight: 23
  },
  priorityNotice: {
    minHeight: 78,
    borderRadius: 8,
    backgroundColor: emergencyTint,
    borderWidth: 1,
    borderColor: "#FFB4AB",
    padding: spacing.md,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md
  },
  priorityText: {
    ...typography.body,
    flex: 1,
    color: emergencyDark,
    fontWeight: "700",
    lineHeight: 22
  },
  searchPanel: {
    borderRadius: 8,
    backgroundColor: emergencySoft,
    borderWidth: 1,
    borderColor: "#FFD0CC",
    padding: spacing.md,
    gap: spacing.sm
  },
  searchBox: {
    minHeight: 52,
    borderRadius: 8,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#F7B5AF",
    paddingHorizontal: spacing.md,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm
  },
  searchInput: {
    ...typography.body,
    flex: 1,
    color: colors.textStrong,
    minHeight: 50
  },
  chipRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.xs
  },
  regionChip: {
    minHeight: 38,
    borderRadius: 8,
    paddingHorizontal: spacing.md,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#F2B8B5"
  },
  regionChipActive: {
    backgroundColor: emergencyRed,
    borderColor: emergencyRed
  },
  regionChipText: {
    ...typography.caption,
    color: emergencyDark,
    fontWeight: "700"
  },
  regionChipTextActive: {
    color: "#FFFFFF"
  },
  districtInput: {
    ...typography.body,
    minHeight: 50,
    borderRadius: 8,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#F7B5AF",
    paddingHorizontal: spacing.md,
    color: colors.textStrong
  },
  actionRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm
  },
  button: {
    minHeight: 48,
    borderRadius: 8,
    paddingHorizontal: spacing.md,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.xs
  },
  buttonFilled: {
    backgroundColor: emergencyRed
  },
  buttonOutline: {
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: emergencyRed
  },
  buttonText: {
    ...typography.button
  },
  buttonTextFilled: {
    color: "#FFFFFF"
  },
  buttonTextOutline: {
    color: emergencyRed
  },
  updatedText: {
    ...typography.caption,
    color: mutedRed
  },
  familyCard: {
    borderRadius: 8,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#FFD0CC",
    padding: spacing.md,
    gap: spacing.sm
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: spacing.sm
  },
  cardEyebrow: {
    ...typography.caption,
    color: emergencyRed,
    fontWeight: "800"
  },
  cardTitle: {
    ...typography.sectionTitle,
    color: colors.textStrong
  },
  familyBadge: {
    borderRadius: 8,
    backgroundColor: emergencyTint,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs
  },
  familyBadgeText: {
    ...typography.caption,
    color: emergencyDark,
    fontWeight: "800"
  },
  familyAdvice: {
    ...typography.body,
    color: colors.text
  },
  noteGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.xs
  },
  notePill: {
    minHeight: 34,
    borderRadius: 8,
    backgroundColor: colors.surfaceAlt,
    paddingHorizontal: spacing.sm,
    alignItems: "center",
    justifyContent: "center"
  },
  noteText: {
    ...typography.caption,
    color: colors.textStrong,
    fontWeight: "700"
  },
  helperText: {
    ...typography.caption,
    color: colors.textMuted,
    lineHeight: 18
  },
  roomCard: {
    borderRadius: 8,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    gap: spacing.sm
  },
  roomCardHighlighted: {
    borderColor: "#FFB4AB",
    shadowColor: emergencyRed,
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 2
  },
  roomTopRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: spacing.sm
  },
  roomTitleArea: {
    flex: 1,
    gap: 2
  },
  roomName: {
    ...typography.sectionTitle,
    color: colors.textStrong
  },
  roomMeta: {
    ...typography.caption,
    color: emergencyRed,
    fontWeight: "800"
  },
  bedBadge: {
    minWidth: 70,
    borderRadius: 8,
    backgroundColor: emergencyTint,
    alignItems: "center",
    paddingVertical: spacing.xs
  },
  bedCount: {
    ...typography.sectionTitle,
    color: emergencyRed
  },
  bedLabel: {
    ...typography.caption,
    color: emergencyDark,
    fontWeight: "800"
  },
  address: {
    ...typography.body,
    color: colors.text,
    lineHeight: 22
  },
  metricRow: {
    flexDirection: "row",
    gap: spacing.sm
  },
  metricBox: {
    flex: 1,
    minHeight: 70,
    borderRadius: 8,
    backgroundColor: colors.surfaceAlt,
    alignItems: "center",
    justifyContent: "center",
    gap: 2
  },
  metricValue: {
    ...typography.sectionTitle,
    color: colors.textStrong
  },
  metricLabel: {
    ...typography.caption,
    color: colors.textMuted,
    fontWeight: "800"
  },
  statusRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.xs
  },
  statusPill: {
    minHeight: 34,
    borderRadius: 8,
    paddingHorizontal: spacing.sm,
    justifyContent: "center"
  },
  statusPillActive: {
    backgroundColor: "#E8F5EE"
  },
  statusPillInactive: {
    backgroundColor: "#F3F4F6"
  },
  statusText: {
    ...typography.caption,
    fontWeight: "800"
  },
  statusTextActive: {
    color: colors.success
  },
  statusTextInactive: {
    color: colors.textMuted
  },
  roomNotice: {
    ...typography.caption,
    color: colors.textMuted,
    lineHeight: 18
  },
  roomActions: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm
  }
});
