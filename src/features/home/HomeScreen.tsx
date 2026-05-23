import { MaterialCommunityIcons } from "@expo/vector-icons";
import { router } from "expo-router";
import type { Href } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { Image, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { AppScreen } from "@/components/AppScreen";
import { useAuth } from "@/auth/AuthProvider";
import { useFamilyProfile } from "@/family/FamilyProfileProvider";
import {
  getLocalFavoritePlaces,
  getLocalMedicineSchedules,
  getLocalRecentPlaces,
  getLocalRegisteredMedicines,
  StoredPlace
} from "@/services/localUserData";
import { colors } from "@/theme/colors";
import { spacing } from "@/theme/spacing";
import { typography } from "@/theme/typography";
import { MedicineSchedule, RegisteredMedicine } from "@/types/domain";

type TodayTask = {
  id: string;
  title: string;
  description: string;
  icon: keyof typeof MaterialCommunityIcons.glyphMap;
  tone: "primary" | "warning" | "danger" | "success";
  route: Href;
};

const situationChips = ["문 연 약국", "야간 약국", "소아과", "응급실", "처방전 OCR", "혈압약"];

export function HomeScreen() {
  const { session } = useAuth();
  const { selectedProfile } = useFamilyProfile();
  const [medicines, setMedicines] = useState<RegisteredMedicine[]>([]);
  const [schedules, setSchedules] = useState<MedicineSchedule[]>([]);
  const [favorites, setFavorites] = useState<StoredPlace[]>([]);
  const [recentPlaces, setRecentPlaces] = useState<StoredPlace[]>([]);
  const [searchText, setSearchText] = useState("");

  const displayName = selectedProfile?.profileName ?? (session?.mode === "guest" ? "비회원" : "나");
  const accountLabel = session?.mode === "member" ? session.nickname ?? "회원" : "비회원";

  useEffect(() => {
    loadDashboard();
  }, [selectedProfile?.profileId, session?.mode, session?.userId]);

  const loadDashboard = async () => {
    const [storedMedicines, storedSchedules, storedFavorites, storedRecentPlaces] = await Promise.all([
      getLocalRegisteredMedicines(selectedProfile),
      getLocalMedicineSchedules(selectedProfile),
      getLocalFavoritePlaces(),
      getLocalRecentPlaces()
    ]);
    setMedicines(storedMedicines);
    setSchedules(storedSchedules);
    setFavorites(storedFavorites);
    setRecentPlaces(storedRecentPlaces);
  };

  const activeMedicines = useMemo(() => medicines.filter((medicine) => medicine.status !== "ended"), [medicines]);
  const durMedicines = useMemo(
    () => activeMedicines.filter((medicine) => medicine.durWarnings?.length || medicine.highRisk),
    [activeMedicines]
  );
  const nextDose = useMemo(() => {
    const medicineById = new Map(activeMedicines.map((medicine) => [String(medicine.id), medicine]));
    const rows = schedules.flatMap((schedule) => {
      const medicine = medicineById.get(String(schedule.medicineId));
      if (!medicine) return [];
      return (schedule.doseTimes.length ? schedule.doseTimes : ["필요 시"]).map((time) => ({
        time,
        medicine,
        schedule
      }));
    });
    return rows.sort((a, b) => a.time.localeCompare(b.time))[0] ?? null;
  }, [activeMedicines, schedules]);

  const todayTasks = useMemo<TodayTask[]>(() => {
    const tasks: TodayTask[] = [];
    if (nextDose) {
      tasks.push({
        id: "next-dose",
        title: `${nextDose.time} ${nextDose.medicine.alias || nextDose.medicine.name}`,
        description: `${nextDose.schedule.doseAmount} · ${nextDose.schedule.doseTiming}`,
        icon: "pill",
        tone: "primary",
        route: "/(tabs)/medication"
      });
    } else {
      tasks.push({
        id: "register-medicine",
        title: "오늘 복약 일정이 없습니다",
        description: "약을 등록하면 시간별 복약 알림과 이력을 볼 수 있어요.",
        icon: "calendar-plus",
        tone: "success",
        route: "/(tabs)/pills"
      });
    }
    if (durMedicines[0]) {
      tasks.push({
        id: "dur-warning",
        title: `${durMedicines[0].alias || durMedicines[0].name} DUR 확인`,
        description: durMedicines[0].durWarnings?.[0] ?? "중복 복용 또는 주의 정보를 확인하세요.",
        icon: "alert-decagram-outline",
        tone: "warning",
        route: "/(tabs)/pills"
      });
    }
    if (!selectedProfile?.emergencyContact || !selectedProfile?.allergies) {
      tasks.push({
        id: "emergency-card",
        title: "응급카드 정보 보완",
        description: "보호자 연락처와 알레르기 정보를 채워두면 응급 상황에 도움이 됩니다.",
        icon: "card-account-details-star-outline",
        tone: "danger",
        route: "/(tabs)/emergency"
      });
    }
    if (recentPlaces[0]) {
      tasks.push({
        id: "recent-place",
        title: `최근 본 장소: ${recentPlaces[0].placeName}`,
        description: recentPlaces[0].address || "최근 이용한 병원·약국을 다시 확인하세요.",
        icon: recentPlaces[0].placeType === "pharmacy" ? "pill" : "hospital-building",
        tone: "primary",
        route: "/(tabs)/map"
      });
    }
    return tasks.slice(0, 4);
  }, [durMedicines, nextDose, recentPlaces, selectedProfile]);

  const profileCompleteness = useMemo(() => {
    const checks = [
      selectedProfile?.profileName,
      selectedProfile?.bloodType,
      selectedProfile?.allergies,
      selectedProfile?.currentMedications,
      selectedProfile?.emergencyContact
    ];
    return Math.round((checks.filter(Boolean).length / checks.length) * 100);
  }, [selectedProfile]);

  const submitSearch = () => {
    const normalized = searchText.trim();
    if (!normalized) return;
    if (normalized.includes("약") || normalized.includes("처방") || normalized.includes("DUR")) {
      router.push("/(tabs)/pills");
      return;
    }
    if (normalized.includes("응급")) {
      router.push("/(tabs)/emergency");
      return;
    }
    router.push("/(tabs)/map");
  };

  const openChip = (chip: string) => {
    setSearchText(chip);
    if (chip.includes("응급")) {
      router.push("/(tabs)/emergency");
      return;
    }
    if (chip.includes("약") || chip.includes("처방")) {
      router.push("/(tabs)/pills");
      return;
    }
    router.push("/(tabs)/map");
  };

  return (
    <AppScreen contentStyle={styles.screen}>
      <View style={styles.topBar}>
        <View style={styles.brandArea}>
          <Image source={require("../../../app_img/allcaremedi.png")} style={styles.mascot} resizeMode="contain" />
          <View>
            <Text style={styles.eyebrow}>올케어메디</Text>
            <Text style={styles.title}>오늘 건강 대시보드</Text>
          </View>
        </View>
        <Pressable style={styles.profileButton} onPress={() => router.push("/(tabs)/family")}>
          <Text style={styles.profileButtonText}>{displayName}</Text>
          <Text style={styles.profileButtonMeta}>{accountLabel}</Text>
        </Pressable>
      </View>

      <View style={styles.searchBox}>
        <MaterialCommunityIcons name="magnify" size={20} color={colors.primary} />
        <TextInput
          accessibilityLabel="상황별 통합 검색"
          value={searchText}
          onChangeText={setSearchText}
          onSubmitEditing={submitSearch}
          placeholder="야간 약국, 소아과, 혈압약, 응급실"
          placeholderTextColor={colors.textMuted}
          style={styles.searchInput}
        />
        <Pressable accessibilityRole="button" style={styles.searchButton} onPress={submitSearch}>
          <Text style={styles.searchButtonText}>검색</Text>
        </Pressable>
      </View>

      <View style={styles.chipRow}>
        {situationChips.map((chip) => (
          <Pressable key={chip} style={styles.situationChip} onPress={() => openChip(chip)}>
            <Text style={styles.situationChipText}>{chip}</Text>
          </Pressable>
        ))}
      </View>

      <View style={styles.summaryGrid}>
        <SummaryMetric label="등록 약" value={`${activeMedicines.length}개`} icon="pill" />
        <SummaryMetric label="오늘 복약" value={nextDose ? nextDose.time : "없음"} icon="clock-outline" />
        <SummaryMetric label="DUR 주의" value={`${durMedicines.length}건`} icon="alert-outline" warning={durMedicines.length > 0} />
        <SummaryMetric label="프로필" value={`${profileCompleteness}%`} icon="account-heart-outline" />
      </View>

      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>오늘 확인할 일</Text>
        <Text style={styles.sectionDescription}>{displayName} 기준으로 먼저 볼 항목입니다.</Text>
      </View>

      {todayTasks.map((task) => (
        <TaskCard key={task.id} task={task} onPress={() => router.push(task.route)} />
      ))}

      <View style={styles.quickActions}>
        <QuickAction label="약 등록" icon="plus-circle-outline" route="/(tabs)/pills" primary />
        <QuickAction label="복약" icon="calendar-check" route="/(tabs)/medication" />
        <QuickAction label="처방전 OCR" icon="text-recognition" route="/(tabs)/pills" />
        <QuickAction label="병원약국" icon="map-marker-radius" route="/(tabs)/map" />
        <QuickAction label="응급실" icon="hospital-box" route="/(tabs)/emergency" danger />
      </View>

      <View style={styles.savedCard}>
        <View style={styles.rowBetween}>
          <Text style={styles.sectionTitle}>최근/즐겨찾기</Text>
          <Pressable onPress={() => router.push("/(tabs)/map")}>
            <Text style={styles.linkText}>전체 보기</Text>
          </Pressable>
        </View>
        <PlaceRow title="즐겨찾기" place={favorites[0]} empty="즐겨찾는 병원·약국이 없습니다." />
        <PlaceRow title="최근 본 장소" place={recentPlaces[0]} empty="최근 본 병원·약국이 없습니다." />
      </View>

      <View style={styles.noticeCard}>
        <MaterialCommunityIcons name="shield-check-outline" size={24} color={colors.primary} />
        <Text style={styles.noticeText}>
          복약·DUR·응급 정보는 건강관리 보조 안내입니다. 실제 복용과 방문 판단은 의사 또는 약사 확인을 권장합니다.
        </Text>
      </View>
    </AppScreen>
  );
}

function SummaryMetric({
  label,
  value,
  icon,
  warning = false
}: {
  label: string;
  value: string;
  icon: keyof typeof MaterialCommunityIcons.glyphMap;
  warning?: boolean;
}) {
  return (
    <View style={[styles.metricCard, warning && styles.metricWarning]}>
      <MaterialCommunityIcons name={icon} size={18} color={warning ? colors.warning : colors.primary} />
      <Text style={styles.metricValue}>{value}</Text>
      <Text style={styles.metricLabel}>{label}</Text>
    </View>
  );
}

function TaskCard({ task, onPress }: { task: TodayTask; onPress: () => void }) {
  const toneStyle =
    task.tone === "warning"
      ? styles.taskWarning
      : task.tone === "danger"
        ? styles.taskDanger
        : task.tone === "success"
          ? styles.taskSuccess
          : styles.taskPrimary;
  return (
    <Pressable style={[styles.taskCard, toneStyle]} onPress={onPress}>
      <View style={styles.taskIcon}>
        <MaterialCommunityIcons name={task.icon} size={20} color="#FFFFFF" />
      </View>
      <View style={styles.taskText}>
        <Text style={styles.taskTitle}>{task.title}</Text>
        <Text style={styles.taskDescription} numberOfLines={2}>{task.description}</Text>
      </View>
      <MaterialCommunityIcons name="chevron-right" size={24} color={colors.textMuted} />
    </Pressable>
  );
}

function QuickAction({
  label,
  icon,
  route,
  primary = false,
  danger = false
}: {
  label: string;
  icon: keyof typeof MaterialCommunityIcons.glyphMap;
  route: Href;
  primary?: boolean;
  danger?: boolean;
}) {
  return (
    <Pressable
      style={[styles.quickButton, primary && styles.quickButtonPrimary, danger && styles.quickButtonDanger]}
      onPress={() => router.push(route)}
    >
      <MaterialCommunityIcons name={icon} size={22} color={primary || danger ? "#FFFFFF" : colors.primary} />
      <Text style={[styles.quickText, (primary || danger) && styles.quickTextFilled]}>{label}</Text>
    </Pressable>
  );
}

function PlaceRow({ title, place, empty }: { title: string; place?: StoredPlace; empty: string }) {
  return (
    <View style={styles.placeRow}>
      <Text style={styles.placeTitle}>{title}</Text>
      <Text style={styles.placeName}>{place?.placeName ?? empty}</Text>
      {place ? (
        <Text style={styles.placeMeta} numberOfLines={1}>
          {place.address}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    gap: spacing.sm,
    paddingHorizontal: 18,
    backgroundColor: colors.background
  },
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.md,
    paddingTop: spacing.sm
  },
  brandArea: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md
  },
  mascot: {
    width: 48,
    height: 48
  },
  eyebrow: {
    ...typography.caption,
    fontWeight: "800",
    color: colors.primary
  },
  title: {
    ...typography.sectionTitle,
    color: colors.textStrong
  },
  profileButton: {
    minWidth: 82,
    minHeight: 46,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#CAD7EE",
    backgroundColor: "#F8FBFF",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: spacing.sm
  },
  profileButtonText: {
    ...typography.button,
    color: colors.primary
  },
  profileButtonMeta: {
    ...typography.caption,
    color: colors.textMuted
  },
  searchBox: {
    minHeight: 52,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#C7D6EA",
    backgroundColor: colors.surface,
    paddingLeft: spacing.md,
    flexDirection: "row",
    alignItems: "center",
    overflow: "hidden"
  },
  searchInput: {
    flex: 1,
    paddingHorizontal: spacing.md,
    ...typography.body,
    color: colors.textStrong
  },
  searchButton: {
    width: 72,
    alignSelf: "stretch",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.primary
  },
  searchButtonText: {
    ...typography.button,
    color: colors.onPrimary
  },
  chipRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.xs
  },
  situationChip: {
    minHeight: 38,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#C7D6EA",
    backgroundColor: "#FFFFFF",
    paddingHorizontal: spacing.sm,
    justifyContent: "center"
  },
  situationChipText: {
    ...typography.caption,
    color: colors.primary,
    fontWeight: "800"
  },
  summaryGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm
  },
  metricCard: {
    flexBasis: "48%",
    flexGrow: 1,
    minHeight: 78,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#C7D6EA",
    backgroundColor: "#FFFFFF",
    padding: spacing.sm,
    gap: spacing.xs
  },
  metricWarning: {
    borderColor: "#FDBA74",
    backgroundColor: "#FFF7ED"
  },
  metricValue: {
    ...typography.bodyLarge,
    fontWeight: "800",
    color: colors.textStrong
  },
  metricLabel: {
    ...typography.caption,
    color: colors.textMuted
  },
  sectionHeader: {
    gap: spacing.xs
  },
  sectionTitle: {
    ...typography.sectionTitle,
    color: colors.textStrong
  },
  sectionDescription: {
    ...typography.body,
    color: colors.text
  },
  taskCard: {
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#D1D5DB",
    backgroundColor: "#FFFFFF",
    padding: spacing.sm,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md
  },
  taskPrimary: {
    borderColor: "#C7D6EA"
  },
  taskWarning: {
    borderColor: "#FDBA74",
    backgroundColor: "#FFF7ED"
  },
  taskDanger: {
    borderColor: "#FFB4AB",
    backgroundColor: "#FFF1F1"
  },
  taskSuccess: {
    borderColor: "#B7E4C7",
    backgroundColor: "#F0FFF4"
  },
  taskIcon: {
    width: 38,
    height: 38,
    borderRadius: 8,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center"
  },
  taskText: {
    flex: 1,
    gap: spacing.xs
  },
  taskTitle: {
    ...typography.bodyLarge,
    fontWeight: "800",
    color: colors.textStrong
  },
  taskDescription: {
    ...typography.body,
    color: colors.text
  },
  quickActions: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm
  },
  quickButton: {
    flexBasis: "48%",
    flexGrow: 1,
    minHeight: 58,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#C7D6EA",
    backgroundColor: "#FFFFFF",
    padding: spacing.sm,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm
  },
  quickButtonPrimary: {
    backgroundColor: colors.primary,
    borderColor: colors.primary
  },
  quickButtonDanger: {
    backgroundColor: "#D92D20",
    borderColor: "#D92D20"
  },
  quickText: {
    ...typography.button,
    color: colors.primary
  },
  quickTextFilled: {
    color: "#FFFFFF"
  },
  savedCard: {
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#C7D6EA",
    backgroundColor: "#FFFFFF",
    padding: spacing.md,
    gap: spacing.sm
  },
  rowBetween: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.md
  },
  linkText: {
    ...typography.caption,
    color: colors.primary,
    fontWeight: "800"
  },
  placeRow: {
    borderRadius: 8,
    backgroundColor: colors.surfaceAlt,
    padding: spacing.md,
    gap: spacing.xs
  },
  placeTitle: {
    ...typography.caption,
    color: colors.primary,
    fontWeight: "800"
  },
  placeName: {
    ...typography.body,
    color: colors.textStrong,
    fontWeight: "800"
  },
  placeMeta: {
    ...typography.caption,
    color: colors.textMuted
  },
  noticeCard: {
    borderRadius: 8,
    backgroundColor: colors.primarySoft,
    padding: spacing.md,
    flexDirection: "row",
    alignItems: "flex-start",
    gap: spacing.sm
  },
  noticeText: {
    ...typography.caption,
    flex: 1,
    color: colors.primaryStrong,
    lineHeight: 19
  }
});
