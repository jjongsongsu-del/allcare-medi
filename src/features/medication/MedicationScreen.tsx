import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useEffect, useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { AppScreen } from "@/components/AppScreen";
import { CurrentFamilyBanner } from "@/components/CurrentFamilyBanner";
import { getRecommendedHealthContents } from "@/services/healthContentService";
import { getMedicationSchedules } from "@/services/medicationService";
import { colors } from "@/theme/colors";
import { spacing } from "@/theme/spacing";
import { typography } from "@/theme/typography";
import { HealthContent, MedicationSchedule } from "@/types/domain";

const statusFilters = ["오늘", "예정", "복용완료", "건너뜀", "중요약", "가족공유"];

export function MedicationScreen() {
  const [schedules, setSchedules] = useState<MedicationSchedule[]>([]);
  const [contents, setContents] = useState<HealthContent[]>([]);
  const [searchText, setSearchText] = useState("");
  const [selectedFilter, setSelectedFilter] = useState("오늘");

  useEffect(() => {
    getMedicationSchedules().then(setSchedules);
    getRecommendedHealthContents().then(setContents);
  }, []);

  const nextSchedule = useMemo(() => schedules[0], [schedules]);
  const adherenceAverage = useMemo(() => {
    if (!schedules.length) return 0;
    return Math.round(schedules.reduce((sum, schedule) => sum + schedule.adherenceRate, 0) / schedules.length);
  }, [schedules]);

  return (
    <AppScreen contentStyle={styles.screen}>
      <View style={styles.hero}>
        <View style={styles.iconBox}>
          <MaterialCommunityIcons name="clock-outline" size={36} color={colors.primary} />
        </View>
        <Text style={styles.eyebrow}>복약</Text>
        <Text style={styles.title}>오늘 먹을 약</Text>
        <Text style={styles.description}>
          복약 시간은 예상 알림이며 약의 변경, 중단, 병용 여부는 방문 전 전문가 확인을 권장합니다.
        </Text>
      </View>

      <View style={styles.searchBox}>
        <MaterialCommunityIcons name="magnify" size={28} color={colors.primary} />
        <TextInput
          value={searchText}
          onChangeText={setSearchText}
          placeholder="약 이름, 시간, 메모 검색"
          placeholderTextColor="#6B7280"
          style={styles.searchInput}
        />
      </View>

      <View style={styles.noticeCard}>
        <View style={styles.noticeIconBox}>
          <MaterialCommunityIcons name="bell-ring-outline" size={32} color={colors.primary} />
        </View>
        <View style={styles.noticeContent}>
          <Text style={styles.noticeTitle}>복약 알림과 가족 공유를 설정할 수 있습니다.</Text>
          <Text style={styles.noticeDescription}>알림은 복약 기록에만 사용되며, 가족 공유는 선택한 가족 프로필 기준으로 관리합니다.</Text>
          <View style={styles.noticeButtons}>
            <MedicationButton label="알림 켜기" icon="bell-plus" variant="filled" />
            <MedicationButton label="나중에" icon="clock-outline" variant="outline" />
            <MedicationButton label="가족에게 공유" icon="account-heart-outline" variant="outline" />
            <MedicationButton label="일정 직접 추가" icon="calendar-plus" variant="outline" />
          </View>
        </View>
      </View>

      <CurrentFamilyBanner compact />

      <View style={styles.primaryActionRow}>
        <Pressable style={styles.bigPrimaryButton}>
          <MaterialCommunityIcons name="plus-circle-outline" size={28} color="#FFFFFF" />
          <Text style={styles.bigPrimaryText}>복용약 등록</Text>
        </Pressable>
        <Text style={styles.radiusText}>완료율 {adherenceAverage}%</Text>
      </View>

      <View style={styles.quickRow}>
        <QuickButton label="처방전 OCR" icon="text-recognition" />
        <QuickButton label="약 검색 등록" icon="pill" />
      </View>

      <View style={styles.filterRow}>
        {statusFilters.map((filter) => (
          <Pressable
            key={filter}
            onPress={() => setSelectedFilter(filter)}
            style={[styles.filterChip, selectedFilter === filter && styles.filterChipActive]}
          >
            <Text style={[styles.filterText, selectedFilter === filter && styles.filterTextActive]}>{filter}</Text>
          </Pressable>
        ))}
      </View>

      <View style={styles.segmentShell}>
        <View style={styles.segmentActive}>
          <Text style={styles.segmentActiveText}>복약 일정</Text>
        </View>
        <View style={styles.segmentInactive}>
          <Text style={styles.segmentInactiveText}>복약 리포트</Text>
        </View>
      </View>

      <View style={styles.summaryCard}>
        <Text style={styles.sectionTitle}>다음 복약</Text>
        {nextSchedule ? (
          <View style={styles.nextSchedule}>
            <View style={styles.timeBox}>
              <Text style={styles.timeText}>{nextSchedule.time}</Text>
              <Text style={styles.timeLabel}>예정</Text>
            </View>
            <View style={styles.scheduleTextArea}>
              <Text style={styles.scheduleTitle}>{nextSchedule.pillName}</Text>
              <Text style={styles.scheduleDescription}>{nextSchedule.instruction}</Text>
              <Text style={styles.scheduleMeta}>복약 완료율 {nextSchedule.adherenceRate}% · {nextSchedule.familyShared ? "가족 공유중" : "개인 관리"}</Text>
            </View>
          </View>
        ) : (
          <View style={styles.emptyBox}>
            <Text style={styles.emptyTitle}>오늘 등록된 복약 일정이 없습니다.</Text>
            <Text style={styles.emptyDescription}>복용약을 등록하면 시간별 복약 알림을 받을 수 있습니다.</Text>
          </View>
        )}
      </View>

      {schedules.map((schedule) => (
        <View key={schedule.id} style={styles.scheduleCard}>
          <View style={styles.scheduleHeader}>
            <View>
              <Text style={styles.cardTime}>{schedule.time}</Text>
              <Text style={styles.cardTitle}>{schedule.pillName}</Text>
            </View>
            <View style={styles.shareBadge}>
              <Text style={styles.shareBadgeText}>{schedule.familyShared ? "가족 공유" : "개인"}</Text>
            </View>
          </View>
          <Text style={styles.body}>{schedule.instruction}</Text>
          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: `${schedule.adherenceRate}%` }]} />
          </View>
          <Text style={styles.meta}>복약 완료율 {schedule.adherenceRate}%</Text>
          <View style={styles.cardActions}>
            <MedicationButton label="복약 완료" icon="check-circle" variant="filled" />
            <MedicationButton label="건너뜀" icon="clock-alert-outline" variant="outline" />
          </View>
        </View>
      ))}

      <View style={styles.contentSection}>
        <Text style={styles.sectionTitle}>맞춤 건강백과</Text>
        <Text style={styles.sectionDescription}>복약 상태와 관심 정보를 바탕으로 추천합니다.</Text>
      </View>

      {contents.map((content) => (
        <View key={content.id} style={styles.contentCard}>
          <Text style={styles.cardTitle}>{content.title}</Text>
          <Text style={styles.meta}>{content.category} · {content.lifeStage}</Text>
          <Text style={styles.body}>{content.summary}</Text>
        </View>
      ))}
    </AppScreen>
  );
}

function MedicationButton({ label, icon, variant }: { label: string; icon: keyof typeof MaterialCommunityIcons.glyphMap; variant: "filled" | "outline" }) {
  const filled = variant === "filled";
  return (
    <Pressable style={[styles.smallButton, filled ? styles.smallButtonFilled : styles.smallButtonOutline]}>
      <MaterialCommunityIcons name={icon} size={18} color={filled ? "#FFFFFF" : colors.primary} />
      <Text style={[styles.smallButtonText, filled ? styles.smallButtonTextFilled : styles.smallButtonTextOutline]}>{label}</Text>
    </Pressable>
  );
}

function QuickButton({ label, icon }: { label: string; icon: keyof typeof MaterialCommunityIcons.glyphMap }) {
  return (
    <Pressable style={styles.quickButton}>
      <MaterialCommunityIcons name={icon} size={26} color={colors.primary} />
      <Text style={styles.quickButtonText}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: {
    backgroundColor: "#FFFFFF",
    gap: spacing.lg
  },
  hero: {
    paddingTop: spacing.sm,
    gap: spacing.xs
  },
  iconBox: {
    width: 68,
    height: 68,
    borderRadius: 8,
    backgroundColor: colors.primarySoft,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing.md
  },
  eyebrow: {
    ...typography.title,
    color: colors.primary,
    fontWeight: "800"
  },
  title: {
    ...typography.display,
    color: colors.textStrong
  },
  description: {
    ...typography.bodyLarge,
    color: colors.text,
    lineHeight: 30
  },
  searchBox: {
    minHeight: 70,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#C7D6EA",
    backgroundColor: "#FFFFFF",
    paddingHorizontal: spacing.lg,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md
  },
  searchInput: {
    ...typography.bodyLarge,
    flex: 1,
    minHeight: 66,
    color: colors.textStrong
  },
  noticeCard: {
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#C7D6EA",
    backgroundColor: colors.surfaceAlt,
    padding: spacing.lg,
    flexDirection: "row",
    alignItems: "flex-start",
    gap: spacing.md
  },
  noticeIconBox: {
    width: 64,
    height: 64,
    borderRadius: 8,
    backgroundColor: colors.primarySoft,
    alignItems: "center",
    justifyContent: "center"
  },
  noticeContent: {
    flex: 1,
    gap: spacing.md
  },
  noticeTitle: {
    ...typography.sectionTitle,
    color: colors.textStrong,
    lineHeight: 28
  },
  noticeDescription: {
    ...typography.bodyLarge,
    color: colors.text,
    lineHeight: 28
  },
  noticeButtons: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm
  },
  primaryActionRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md
  },
  bigPrimaryButton: {
    flex: 1,
    minHeight: 64,
    borderRadius: 8,
    backgroundColor: colors.primary,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm
  },
  bigPrimaryText: {
    ...typography.title,
    color: "#FFFFFF"
  },
  radiusText: {
    ...typography.sectionTitle,
    color: colors.text
  },
  quickRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm
  },
  quickButton: {
    minHeight: 52,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#C7D6EA",
    backgroundColor: "#FFFFFF",
    paddingHorizontal: spacing.md,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm
  },
  quickButtonText: {
    ...typography.button,
    color: colors.primary
  },
  filterRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm
  },
  filterChip: {
    minHeight: 54,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#D1D5DB",
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: spacing.lg
  },
  filterChipActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary
  },
  filterText: {
    ...typography.button,
    color: colors.text
  },
  filterTextActive: {
    color: "#FFFFFF"
  },
  segmentShell: {
    minHeight: 58,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.primary,
    flexDirection: "row",
    overflow: "hidden"
  },
  segmentActive: {
    flex: 1,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center"
  },
  segmentInactive: {
    flex: 1,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center"
  },
  segmentActiveText: {
    ...typography.button,
    color: "#FFFFFF"
  },
  segmentInactiveText: {
    ...typography.button,
    color: colors.primary
  },
  summaryCard: {
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: "#FFFFFF",
    padding: spacing.lg,
    gap: spacing.md
  },
  sectionTitle: {
    ...typography.title,
    color: colors.textStrong
  },
  nextSchedule: {
    flexDirection: "row",
    gap: spacing.md,
    alignItems: "stretch"
  },
  timeBox: {
    minWidth: 94,
    borderRadius: 8,
    backgroundColor: colors.primarySoft,
    alignItems: "center",
    justifyContent: "center",
    padding: spacing.md
  },
  timeText: {
    ...typography.title,
    color: colors.primary
  },
  timeLabel: {
    ...typography.caption,
    color: colors.primaryStrong
  },
  scheduleTextArea: {
    flex: 1,
    gap: spacing.xs
  },
  scheduleTitle: {
    ...typography.sectionTitle,
    color: colors.textStrong
  },
  scheduleDescription: {
    ...typography.body,
    color: colors.text
  },
  scheduleMeta: {
    ...typography.caption,
    color: colors.textMuted
  },
  emptyBox: {
    minHeight: 104,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#C7D6EA",
    backgroundColor: colors.surfaceAlt,
    padding: spacing.lg,
    justifyContent: "center",
    gap: spacing.xs
  },
  emptyTitle: {
    ...typography.sectionTitle,
    color: colors.textStrong
  },
  emptyDescription: {
    ...typography.body,
    color: colors.text
  },
  scheduleCard: {
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: "#FFFFFF",
    padding: spacing.md,
    gap: spacing.sm
  },
  scheduleHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: spacing.md
  },
  cardTime: {
    ...typography.title,
    color: colors.primary
  },
  cardTitle: {
    ...typography.sectionTitle,
    color: colors.textStrong
  },
  shareBadge: {
    minHeight: 34,
    borderRadius: 8,
    backgroundColor: colors.primarySoft,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: spacing.sm
  },
  shareBadgeText: {
    ...typography.caption,
    color: colors.primaryStrong
  },
  body: {
    ...typography.body,
    color: colors.text
  },
  progressTrack: {
    height: 10,
    borderRadius: 8,
    backgroundColor: colors.surfaceAlt,
    overflow: "hidden"
  },
  progressFill: {
    height: 10,
    borderRadius: 8,
    backgroundColor: colors.primary
  },
  meta: {
    ...typography.caption,
    color: colors.textMuted
  },
  cardActions: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm
  },
  smallButton: {
    minHeight: 48,
    borderRadius: 8,
    paddingHorizontal: spacing.md,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.xs
  },
  smallButtonFilled: {
    backgroundColor: colors.primary
  },
  smallButtonOutline: {
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: colors.primary
  },
  smallButtonText: {
    ...typography.button
  },
  smallButtonTextFilled: {
    color: "#FFFFFF"
  },
  smallButtonTextOutline: {
    color: colors.primary
  },
  contentSection: {
    gap: spacing.xs
  },
  sectionDescription: {
    ...typography.body,
    color: colors.text
  },
  contentCard: {
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: "#FFFFFF",
    padding: spacing.md,
    gap: spacing.xs
  }
});
