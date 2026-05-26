import { MaterialCommunityIcons } from "@expo/vector-icons";
import { router } from "expo-router";
import type { Href } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { Image, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { AppScreen } from "@/components/AppScreen";
import { MenuHelpButton } from "@/components/MenuHelpButton";
import { useAuth } from "@/auth/AuthProvider";
import { useExperienceMode } from "@/experience/ExperienceModeProvider";
import { useFamilyProfile } from "@/family/FamilyProfileProvider";
import { menuHelp } from "@/help/menuHelp";
import {
  getLocalFavoritePlaces,
  getLocalMedicineSchedules,
  getLocalRecentPlaces,
  getLocalRegisteredMedicines,
  StoredPlace
} from "@/services/localUserData";
import { getRecommendedHealthContents, searchHealthContents } from "@/services/healthContentService";
import { colors } from "@/theme/colors";
import { designOne } from "@/theme/designOne";
import { designThree } from "@/theme/designThree";
import { designTwo } from "@/theme/designTwo";
import { useDesignMode } from "@/theme/DesignModeProvider";
import { spacing } from "@/theme/spacing";
import { typography } from "@/theme/typography";
import { HealthContent, MedicineSchedule, RegisteredMedicine } from "@/types/domain";

type TodayTask = {
  id: string;
  title: string;
  description: string;
  icon: keyof typeof MaterialCommunityIcons.glyphMap;
  tone: "primary" | "warning" | "danger" | "success";
  route: Href;
};

type SummaryTone = "medicine" | "schedule" | "warning";

const situationChips = ["문 연 약국", "야간 약국", "소아과", "응급실", "처방전 OCR", "혈압약"];
const healthInfoLabels = ["혈액형", "알레르기", "기저질환", "복용약", "응급연락처"];

export function HomeScreen() {
  const { session } = useAuth();
  const { isEasyMode } = useExperienceMode();
  const { isDesignOne, isDesignTwo, isDesignThree } = useDesignMode();
  const { selectedProfile } = useFamilyProfile();
  const [medicines, setMedicines] = useState<RegisteredMedicine[]>([]);
  const [schedules, setSchedules] = useState<MedicineSchedule[]>([]);
  const [favorites, setFavorites] = useState<StoredPlace[]>([]);
  const [recentPlaces, setRecentPlaces] = useState<StoredPlace[]>([]);
  const [healthContents, setHealthContents] = useState<HealthContent[]>([]);
  const [healthSearchResults, setHealthSearchResults] = useState<HealthContent[]>([]);
  const [searchText, setSearchText] = useState("");
  const [healthSearchMessage, setHealthSearchMessage] = useState<string | null>(null);

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
    getRecommendedHealthContents().then(setHealthContents).catch(() => undefined);
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
        title: `${durMedicines[0].alias || durMedicines[0].name} 의약품 주의 확인`,
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
  const healthInfoCount = useMemo(() => {
    const checks = [
      selectedProfile?.bloodType,
      selectedProfile?.allergies,
      selectedProfile?.chronicDiseases,
      selectedProfile?.currentMedications,
      selectedProfile?.emergencyContact
    ];
    return checks.filter(Boolean).length;
  }, [selectedProfile]);

  const submitSearch = async () => {
    const normalized = searchText.trim();
    if (!normalized) return;
    setHealthSearchMessage(null);
    try {
      const results = await searchHealthContents(normalized);
      if (results.length) {
        setHealthSearchResults(results);
        return;
      }
      setHealthSearchResults([]);
      setHealthSearchMessage("건강정보 검색 결과가 없어 관련 메뉴로 이동합니다.");
    } catch {
      setHealthSearchMessage("건강정보 API 연결에 문제가 있어 관련 메뉴로 이동합니다.");
    }
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
    <AppScreen contentStyle={[styles.screen, isEasyMode && styles.easyScreen, isDesignOne && styles.designOneScreen, isDesignTwo && styles.designTwoScreen, isDesignThree && styles.designThreeScreen]}>
      <View style={styles.appHeader}>
        <Text style={styles.appName}>AllCareMedi</Text>
        <View style={styles.headerActions}>
          <MenuHelpButton content={menuHelp.home} size={42} />
          <Pressable style={styles.headerIconButton} onPress={() => router.push("/(tabs)/family")}>
            <MaterialCommunityIcons name="account-heart-outline" size={24} color={colors.textStrong} />
          </Pressable>
          <Pressable style={styles.headerIconButton} onPress={() => router.push("/(tabs)/emergency")}>
            <MaterialCommunityIcons name="hospital-box" size={24} color="#D92D20" />
          </Pressable>
        </View>
      </View>

      <View style={[styles.heroCard, isDesignOne && styles.designOneHeroCard, isDesignTwo && styles.designTwoHeroCard, isDesignThree && styles.designThreeHeroCard]}>
        <View style={styles.brandArea}>
          <Image source={require("../../../app_img/allcaremedi.png")} style={styles.mascot} resizeMode="contain" />
          <View style={styles.heroTextGroup}>
            <Text style={[styles.eyebrow, isDesignOne && styles.designOneHeroEyebrow, isDesignThree && styles.designThreeHeroEyebrow]}>올케어메디</Text>
            <Text style={[styles.title, isDesignOne && styles.designOneHeroTitle, isDesignThree && styles.designThreeHeroTitle]}>오늘 건강 대시보드</Text>
            <Text style={[styles.heroDescription, isDesignOne && styles.designOneHeroDescription, isDesignThree && styles.designThreeHeroDescription]}>{displayName} 기준으로 복약, 의약품 주의, 병원약국, 응급 정보를 한 번에 확인합니다.</Text>
          </View>
        </View>
        <Pressable style={[styles.profileButton, isDesignOne && styles.designOneProfileButton, isDesignThree && styles.designThreeProfileButton]} onPress={() => router.push("/(tabs)/family")}>
          <Text style={[styles.profileButtonText, isDesignOne && styles.designOneProfileButtonText, isDesignThree && styles.designThreeProfileButtonText]}>{displayName}</Text>
          <Text style={[styles.profileButtonMeta, isDesignOne && styles.designOneProfileButtonMeta, isDesignThree && styles.designThreeProfileButtonMeta]}>{accountLabel}</Text>
        </Pressable>
      </View>

      <View style={[styles.searchCard, isDesignOne && styles.designOneCard, isDesignTwo && styles.designTwoCard, isDesignThree && styles.designThreeCard]}>
        <View style={[styles.searchBox, isDesignOne && styles.designOneSearchBox]}>
          <MaterialCommunityIcons name="magnify" size={22} color={colors.primary} />
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
            <Pressable key={chip} style={[styles.situationChip, isDesignOne && styles.designOneChip]} onPress={() => openChip(chip)}>
              <Text style={[styles.situationChipText, isDesignOne && styles.designOneChipText]}>{chip}</Text>
            </Pressable>
          ))}
        </View>
        {healthSearchMessage ? <Text style={styles.searchMessage}>{healthSearchMessage}</Text> : null}
        {healthSearchResults.length ? (
          <View style={styles.healthSearchList}>
            <View style={styles.rowBetween}>
              <Text style={styles.sectionTitle}>건강정보 검색 결과</Text>
              <Pressable onPress={() => setHealthSearchResults([])}>
                <Text style={styles.linkText}>닫기</Text>
              </Pressable>
            </View>
            {healthSearchResults.map((content) => (
              <HealthContentRow key={content.id} content={content} />
            ))}
          </View>
        ) : null}
      </View>

      <View style={[styles.summaryCard, isDesignOne && styles.designOneCard, isDesignTwo && styles.designTwoCard, isDesignThree && styles.designThreeCard]}>
        <View style={styles.rowBetween}>
          <Text style={styles.sectionTitle}>건강 요약</Text>
          <Text style={styles.sectionMeta}>{displayName} 기준</Text>
        </View>
        <View style={styles.summaryGrid}>
          <SummaryMetric label="등록 약" value={`${activeMedicines.length}개`} description="관리 중" tone="medicine" />
          <SummaryMetric label="오늘 복약" value={nextDose ? nextDose.time : "없음"} description={nextDose ? "다음 시간" : "일정 없음"} tone="schedule" />
          <SummaryMetric label="의약품 주의" value={`${durMedicines.length}건`} description={durMedicines.length ? "확인 필요" : "주의 없음"} tone="warning" />
        </View>
      </View>

      {!isEasyMode ? (
        <>
          <View style={[styles.feedCard, isDesignOne && styles.designOneCard, isDesignTwo && styles.designTwoCard, isDesignThree && styles.designThreeCard]}>
            <View style={styles.rowBetween}>
              <View>
                <Text style={styles.sectionTitle}>오늘 확인할 일</Text>
                <Text style={styles.sectionDescription}>{displayName} 기준으로 먼저 볼 항목입니다.</Text>
              </View>
              <View style={styles.orangeDot} />
            </View>
            {todayTasks.map((task) => (
              <TaskCard key={task.id} task={task} onPress={() => router.push(task.route)} />
            ))}
          </View>

          <View style={[styles.savedCard, isDesignOne && styles.designOneCard, isDesignTwo && styles.designTwoCard, isDesignThree && styles.designThreeCard]}>
            <View style={styles.rowBetween}>
              <Text style={styles.sectionTitle}>최근/즐겨찾기</Text>
              <Pressable onPress={() => router.push("/(tabs)/map")}>
                <Text style={styles.linkText}>전체 보기</Text>
              </Pressable>
            </View>
            <PlaceRow title="즐겨찾기" place={favorites[0]} empty="즐겨찾는 병원·약국이 없습니다." />
            <PlaceRow title="최근 본 장소" place={recentPlaces[0]} empty="최근 본 병원·약국이 없습니다." />
          </View>

          <View style={[styles.kdcaCard, isDesignOne && styles.designOneCard, isDesignTwo && styles.designTwoCard, isDesignThree && styles.designThreeCard]}>
            <View style={styles.rowBetween}>
              <View>
                <Text style={styles.sectionTitle}>질병 건강정보</Text>
                <Text style={styles.sectionDescription}>질병관리청 국가건강정보포털 콘텐츠입니다.</Text>
              </View>
              <MaterialCommunityIcons name="book-heart-outline" size={24} color={colors.primary} />
            </View>
            {healthContents.slice(0, 3).map((content) => (
              <HealthContentRow key={content.id} content={content} />
            ))}
          </View>

          <View style={[styles.healthRecordCard, isDesignOne && styles.designOneCard, isDesignTwo && styles.designTwoCard, isDesignThree && styles.designThreeCard]}>
            <View style={styles.rowBetween}>
              <View style={styles.recordTitleRow}>
                <View style={styles.recordIcon}>
                  <MaterialCommunityIcons name="heart-pulse" size={20} color="#FFFFFF" />
                </View>
                <Text style={styles.sectionTitle}>건강정보</Text>
              </View>
              <Pressable style={styles.recordButton} onPress={() => router.push("/(tabs)/family")}>
                <Text style={styles.recordButtonText}>수정</Text>
              </Pressable>
            </View>
            <Text style={styles.sectionDescription}>응급카드와 맞춤 추천에 쓰이는 기본 건강정보입니다.</Text>
            <View style={styles.progressTrack}>
              <View style={[styles.progressFill, { width: `${profileCompleteness}%` }]} />
            </View>
            <View style={styles.healthInfoRow}>
              {healthInfoLabels.map((label, index) => (
                <View key={label} style={[styles.healthInfoDot, index < healthInfoCount && styles.healthInfoDotActive]} />
              ))}
            </View>
            <Text style={styles.healthInfoText}>{healthInfoCount}/5개 등록 · 완성 {profileCompleteness}%</Text>
          </View>
        </>
      ) : null}

      <View style={[styles.noticeCard, isDesignOne && styles.designOneCard, isDesignTwo && styles.designTwoCard, isDesignThree && styles.designThreeCard]}>
        <MaterialCommunityIcons name="shield-check-outline" size={24} color={colors.primary} />
        <Text style={styles.noticeText}>
          복약·DUR·응급 정보는 건강관리 보조 안내입니다. 실제 복용과 방문 판단은 의사 또는 약사 확인을 권장합니다.
        </Text>
      </View>

      <View style={[styles.insightCard, isDesignOne && styles.designOneInsightCard, isDesignTwo && styles.designTwoInsightCard, isDesignThree && styles.designThreeInsightCard]}>
        <Text style={styles.insightText}>지금 필요한 건강 정보를 먼저 모아봤어요.</Text>
        <Text style={styles.insightDescription}>
          복약 시간, 의약품 주의, 주변 병원약국, 응급카드를 상황에 맞게 확인할 수 있습니다.
        </Text>
        <Pressable style={styles.insightButton} onPress={() => router.push("/(tabs)/family")}>
          <Text style={styles.insightButtonText}>관리 대상 확인</Text>
        </Pressable>
      </View>
    </AppScreen>
  );
}

function SummaryMetric({
  label,
  value,
  description,
  tone
}: {
  label: string;
  value: string;
  description: string;
  tone: SummaryTone;
}) {
  const { isDesignThree } = useDesignMode();
  const toneStyle =
    tone === "warning"
      ? styles.metricWarning
      : tone === "schedule"
        ? styles.metricSchedule
        : styles.metricMedicine;
  const designThreeToneStyle =
    tone === "warning"
      ? styles.designThreeMetricWarning
      : tone === "schedule"
        ? styles.designThreeMetricSchedule
        : styles.designThreeMetricMedicine;
  return (
    <View style={[styles.metricCard, toneStyle, isDesignThree && styles.designThreeMetricCard, isDesignThree && designThreeToneStyle]}>
      <View style={styles.metricTextGroup}>
        <Text style={styles.metricLabel}>{label}</Text>
        <Text style={styles.metricValue}>{value}</Text>
        <Text style={styles.metricDescription}>{description}</Text>
      </View>
    </View>
  );
}

function TaskCard({ task, onPress }: { task: TodayTask; onPress: () => void }) {
  const { isDesignThree } = useDesignMode();
  const toneStyle =
    task.tone === "warning"
      ? styles.taskWarning
      : task.tone === "danger"
        ? styles.taskDanger
        : task.tone === "success"
          ? styles.taskSuccess
          : styles.taskPrimary;
  return (
    <Pressable style={[styles.taskCard, toneStyle, isDesignThree && styles.designThreeTaskCard]} onPress={onPress}>
      <View style={[styles.taskIcon, isDesignThree && styles.designThreeTaskIcon]}>
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

function HealthContentRow({ content }: { content: HealthContent }) {
  const { isDesignThree } = useDesignMode();
  return (
    <View style={[styles.healthContentRow, isDesignThree && styles.designThreeHealthContentRow]}>
      <View style={[styles.healthContentIcon, isDesignThree && styles.designThreeHealthContentIcon]}>
        <MaterialCommunityIcons name="file-document-outline" size={18} color={colors.primary} />
      </View>
      <View style={styles.healthContentText}>
        <Text style={styles.healthContentTitle}>{content.title}</Text>
        <Text style={styles.healthContentMeta}>{content.category} · {content.superclass ?? "건강정보"}</Text>
        <Text style={styles.healthContentSummary} numberOfLines={2}>{content.summary}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    gap: spacing.md,
    paddingHorizontal: 16,
    backgroundColor: "#FFFFFF"
  },
  designOneScreen: {
    backgroundColor: designOne.body,
    paddingHorizontal: 24,
    gap: spacing.lg
  },
  designTwoScreen: {
    backgroundColor: designTwo.background,
    paddingHorizontal: 18,
    gap: spacing.lg
  },
  designThreeScreen: {
    backgroundColor: designThree.background,
    paddingHorizontal: 20,
    gap: spacing.lg
  },
  easyScreen: {
    gap: spacing.xl,
    paddingHorizontal: spacing.xl
  },
  appHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingTop: spacing.md,
    paddingBottom: spacing.xs
  },
  appName: {
    ...typography.sectionTitle,
    color: colors.textStrong,
    fontWeight: "900"
  },
  headerActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm
  },
  headerIconButton: {
    width: 42,
    height: 42,
    borderRadius: 4,
    backgroundColor: "#F7F7F7",
    alignItems: "center",
    justifyContent: "center"
  },
  heroCard: {
    borderRadius: 4,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E5E7EB",
    padding: spacing.lg,
    gap: spacing.md
  },
  designOneHeroCard: {
    borderWidth: 0,
    backgroundColor: designOne.primaryDark,
    borderRadius: designOne.radiusCard,
    shadowColor: "#2F248F",
    shadowOpacity: 0.18,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
    elevation: 5
  },
  designTwoHeroCard: {
    borderWidth: 0,
    backgroundColor: designTwo.card,
    borderRadius: designTwo.radiusCard,
    ...designTwo.shadow
  },
  designThreeHeroCard: {
    borderWidth: 0,
    backgroundColor: designThree.card,
    borderRadius: designThree.radiusCard,
    padding: spacing.xl,
    ...designThree.shadow
  },
  brandArea: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md
  },
  heroTextGroup: {
    flex: 1,
    minWidth: 0,
    gap: 3
  },
  mascot: {
    width: 82,
    height: 82
  },
  eyebrow: {
    ...typography.body,
    fontWeight: "800",
    color: colors.primary,
    lineHeight: 24
  },
  title: {
    ...typography.title,
    color: colors.textStrong,
    lineHeight: 34
  },
  heroDescription: {
    ...typography.caption,
    color: colors.text,
    lineHeight: 20
  },
  designOneHeroEyebrow: {
    color: "#DCD7FF"
  },
  designOneHeroTitle: {
    color: "#FFFFFF"
  },
  designOneHeroDescription: {
    color: "#EEEAFB"
  },
  designThreeHeroEyebrow: {
    color: "#DDD1FF"
  },
  designThreeHeroTitle: {
    color: "#FFFFFF"
  },
  designThreeHeroDescription: {
    color: "#F5EEFF"
  },
  profileButton: {
    alignSelf: "flex-start",
    minWidth: 92,
    minHeight: 46,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: "#C7D6EA",
    backgroundColor: "#F8FBFF",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: spacing.md
  },
  profileButtonText: {
    ...typography.button,
    color: colors.primary
  },
  profileButtonMeta: {
    ...typography.caption,
    color: colors.textMuted
  },
  designOneProfileButton: {
    borderWidth: 0,
    borderRadius: designOne.radiusPill,
    backgroundColor: "#FFFFFF"
  },
  designOneProfileButtonText: {
    color: designOne.primary
  },
  designOneProfileButtonMeta: {
    color: designOne.muted
  },
  designThreeProfileButton: {
    borderWidth: 0,
    borderRadius: designThree.radiusButton,
    backgroundColor: "#FFFFFF"
  },
  designThreeProfileButtonText: {
    color: designThree.primary
  },
  designThreeProfileButtonMeta: {
    color: designThree.muted
  },
  designOneHeaderText: {
    color: "#FFFFFF"
  },
  searchCard: {
    borderRadius: 4,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E5E7EB",
    padding: spacing.md,
    gap: spacing.sm
  },
  designOneCard: {
    borderWidth: 0,
    backgroundColor: designOne.surface,
    borderRadius: designOne.radiusCard,
    ...designOne.shadow
  },
  designTwoCard: {
    borderWidth: 0,
    backgroundColor: designTwo.cardSoft,
    borderRadius: designTwo.radiusCard,
    ...designTwo.shadow
  },
  designThreeCard: {
    borderWidth: 0,
    borderColor: designThree.border,
    backgroundColor: "#FFFFFF",
    borderRadius: designThree.radiusTile,
    ...designThree.shadow
  },
  searchBox: {
    minHeight: 52,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: "#C7D6EA",
    backgroundColor: "#F8FBFF",
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
    width: 76,
    alignSelf: "stretch",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.primary,
    borderTopRightRadius: 4,
    borderBottomRightRadius: 4
  },
  searchButtonText: {
    ...typography.button,
    color: colors.onPrimary
  },
  designOneSearchBox: {
    borderWidth: 0,
    borderRadius: designOne.radiusButton,
    backgroundColor: "#FFFFFF"
  },
  searchMessage: {
    ...typography.caption,
    color: colors.textMuted,
    lineHeight: 18
  },
  healthSearchList: {
    gap: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: "#E5E7EB",
    paddingTop: spacing.sm
  },
  chipRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.xs
  },
  situationChip: {
    minHeight: 38,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: "#C7D6EA",
    backgroundColor: "#FFFFFF",
    paddingHorizontal: spacing.md,
    justifyContent: "center"
  },
  situationChipText: {
    ...typography.caption,
    color: colors.primary,
    fontWeight: "800"
  },
  designOneChipText: {
    color: designOne.primary,
    fontWeight: "900"
  },
  insightCard: {
    borderRadius: 4,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E5E7EB",
    padding: spacing.lg,
    gap: spacing.sm
  },
  designOneChip: {
    borderWidth: 0,
    borderRadius: designOne.radiusPill,
    backgroundColor: designOne.surfaceAlt
  },
  designOneInsightCard: {
    borderColor: "#D8F3DC",
    backgroundColor: "#F0FFF4",
    borderRadius: 8
  },
  designTwoInsightCard: {
    borderWidth: 0,
    backgroundColor: designTwo.primaryLight,
    borderRadius: designTwo.radiusCard
  },
  designThreeInsightCard: {
    borderWidth: 0,
    backgroundColor: designThree.primarySoft,
    borderRadius: designThree.radiusTile
  },
  insightText: {
    ...typography.sectionTitle,
    color: "#047857",
    lineHeight: 30
  },
  insightDescription: {
    ...typography.body,
    color: colors.text,
    lineHeight: 23
  },
  insightButton: {
    alignSelf: "flex-end",
    minHeight: 38,
    borderRadius: 4,
    backgroundColor: "#BBF7D0",
    paddingHorizontal: spacing.md,
    alignItems: "center",
    justifyContent: "center"
  },
  insightButtonText: {
    ...typography.button,
    color: "#047857"
  },
  summaryCard: {
    borderRadius: 4,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E5E7EB",
    padding: spacing.lg,
    gap: spacing.md
  },
  summaryGrid: {
    flexDirection: "row",
    gap: spacing.sm
  },
  metricCard: {
    flex: 1,
    minWidth: 0,
    minHeight: 126,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: "#C7D6EA",
    backgroundColor: "#FFFFFF",
    padding: spacing.sm,
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.xs
  },
  designThreeMetricCard: {
    borderWidth: 0,
    borderRadius: designThree.radiusTile,
    minHeight: 112,
    alignItems: "flex-start",
    padding: spacing.md
  },
  designThreeMetricMedicine: {
    backgroundColor: designThree.blueCard
  },
  designThreeMetricSchedule: {
    backgroundColor: designThree.pinkCard
  },
  designThreeMetricWarning: {
    backgroundColor: designThree.peachCard
  },
  metricMedicine: {
    borderColor: "#D1FAE5",
    backgroundColor: "#F7FEFA"
  },
  metricSchedule: {
    borderColor: "#BFDBFE",
    backgroundColor: "#F8FBFF"
  },
  metricWarning: {
    borderColor: "#FDBA74",
    backgroundColor: "#FFF7ED"
  },
  metricTextGroup: {
    alignItems: "center",
    gap: spacing.xs,
    minWidth: 0
  },
  metricValue: {
    ...typography.title,
    fontWeight: "800",
    color: colors.textStrong,
    lineHeight: 36,
    textAlign: "center"
  },
  metricLabel: {
    ...typography.bodyLarge,
    color: colors.textStrong,
    fontWeight: "900",
    lineHeight: 26,
    textAlign: "center"
  },
  metricDescription: {
    ...typography.caption,
    color: colors.textMuted,
    fontWeight: "800",
    lineHeight: 18,
    textAlign: "center"
  },
  sectionTitle: {
    ...typography.sectionTitle,
    color: colors.textStrong
  },
  sectionMeta: {
    ...typography.caption,
    color: colors.textMuted,
    fontWeight: "800"
  },
  sectionDescription: {
    ...typography.body,
    color: colors.text
  },
  feedCard: {
    borderRadius: 4,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E5E7EB",
    padding: spacing.lg,
    gap: spacing.md
  },
  orangeDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#F97316"
  },
  taskCard: {
    borderRadius: 4,
    borderWidth: 1,
    borderColor: "#D1D5DB",
    backgroundColor: "#F9FAFB",
    padding: spacing.md,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md
  },
  designThreeTaskCard: {
    borderWidth: 0,
    borderRadius: designThree.radiusTile,
    backgroundColor: "#FFFFFF",
    ...designThree.shadow
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
    width: 46,
    height: 46,
    borderRadius: 4,
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
  savedCard: {
    borderRadius: 4,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    backgroundColor: "#FFFFFF",
    padding: spacing.lg,
    gap: spacing.md
  },
  kdcaCard: {
    borderRadius: 4,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    backgroundColor: "#FFFFFF",
    padding: spacing.lg,
    gap: spacing.md
  },
  healthContentRow: {
    borderRadius: 4,
    backgroundColor: "#F8FBFF",
    borderWidth: 1,
    borderColor: "#C7D6EA",
    padding: spacing.md,
    flexDirection: "row",
    alignItems: "flex-start",
    gap: spacing.md
  },
  designThreeHealthContentRow: {
    borderWidth: 0,
    borderRadius: designThree.radiusTile,
    backgroundColor: designThree.blueCard
  },
  healthContentIcon: {
    width: 38,
    height: 38,
    borderRadius: 4,
    backgroundColor: colors.primarySoft,
    alignItems: "center",
    justifyContent: "center"
  },
  designThreeHealthContentIcon: {
    borderRadius: 16,
    backgroundColor: "#FFFFFF"
  },
  designThreeTaskIcon: {
    borderRadius: 16,
    backgroundColor: designThree.primary
  },
  healthContentText: {
    flex: 1,
    minWidth: 0,
    gap: 2
  },
  healthContentTitle: {
    ...typography.bodyLarge,
    color: colors.textStrong,
    fontWeight: "900"
  },
  healthContentMeta: {
    ...typography.caption,
    color: colors.primary,
    fontWeight: "800"
  },
  healthContentSummary: {
    ...typography.caption,
    color: colors.text,
    lineHeight: 18
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
    borderRadius: 4,
    backgroundColor: "#F9FAFB",
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
  healthRecordCard: {
    borderRadius: 4,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E5E7EB",
    padding: spacing.lg,
    gap: spacing.md
  },
  recordTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm
  },
  recordIcon: {
    width: 34,
    height: 34,
    borderRadius: 4,
    backgroundColor: "#858A91",
    alignItems: "center",
    justifyContent: "center"
  },
  recordButton: {
    minHeight: 36,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    paddingHorizontal: spacing.md,
    alignItems: "center",
    justifyContent: "center"
  },
  recordButtonText: {
    ...typography.caption,
    color: colors.textStrong,
    fontWeight: "800"
  },
  progressTrack: {
    height: 12,
    borderRadius: 2,
    backgroundColor: "#EEF0F2",
    overflow: "hidden"
  },
  progressFill: {
    height: "100%",
    borderRadius: 2,
    backgroundColor: "#22C55E"
  },
  healthInfoRow: {
    flexDirection: "row",
    gap: spacing.xs
  },
  healthInfoDot: {
    flex: 1,
    height: 8,
    borderRadius: 2,
    backgroundColor: "#E5E7EB"
  },
  healthInfoDotActive: {
    backgroundColor: "#86EFAC"
  },
  healthInfoText: {
    ...typography.caption,
    color: colors.textMuted
  },
  noticeCard: {
    borderRadius: 4,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E5E7EB",
    padding: spacing.lg,
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
