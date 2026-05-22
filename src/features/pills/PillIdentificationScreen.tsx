import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { AppScreen } from "@/components/AppScreen";
import { CurrentFamilyBanner } from "@/components/CurrentFamilyBanner";
import { recognizePillFromImage } from "@/services/pillRecognitionService";
import { colors } from "@/theme/colors";
import { spacing } from "@/theme/spacing";
import { typography } from "@/theme/typography";
import { Pill } from "@/types/domain";

type PillTab = "medicine" | "prescription";

export function PillIdentificationScreen() {
  const [pills, setPills] = useState<Pill[]>([]);
  const [activeTab, setActiveTab] = useState<PillTab>("medicine");
  const [searchText, setSearchText] = useState("");

  useEffect(() => {
    recognizePillFromImage().then(setPills);
  }, []);

  return (
    <AppScreen contentStyle={styles.screen}>
      <View style={styles.hero}>
        <View style={styles.iconBox}>
          <MaterialCommunityIcons name="archive-outline" size={36} color={colors.primary} />
        </View>
        <Text style={styles.eyebrow}>내 약통</Text>
        <Text style={styles.title}>약관리</Text>
        <Text style={styles.description}>
          등록된 약 목록을 확인하고, 약을 추가하거나 선택해서 변경·삭제할 수 있습니다.
        </Text>
      </View>

      <View style={styles.notice}>
        <MaterialCommunityIcons name="alert-circle-outline" size={28} color={noticeText} />
        <Text style={styles.noticeText}>
          이 기능은 복약 기록과 알림을 돕기 위한 기능입니다. 약의 변경, 중단, 병용 여부는 반드시 의사 또는 약사와 상담하세요.
        </Text>
      </View>

      <CurrentFamilyBanner compact />

      <View style={styles.segmented}>
        <SegmentButton label="약관리" active={activeTab === "medicine"} onPress={() => setActiveTab("medicine")} />
        <SegmentButton label="처방전 관리" active={activeTab === "prescription"} onPress={() => setActiveTab("prescription")} />
      </View>

      <View style={styles.actionGrid}>
        <RegistrationTile
          title="직접등록"
          description="수기로 입력"
          icon="square-edit-outline"
          active
        />
        <RegistrationTile
          title="검색등록"
          description="e약 검색"
          icon="magnify"
        />
        <RegistrationTile
          title="AI판독등록"
          description="사진 판독"
          icon="camera-outline"
        />
      </View>

      <View style={styles.listCard}>
        <View style={styles.listHeader}>
          <Text style={styles.sectionTitle}>등록된 약 목록</Text>
          <Pressable style={styles.addButton}>
            <Text style={styles.addButtonText}>등록</Text>
          </Pressable>
        </View>

        <View style={styles.searchBox}>
          <TextInput
            value={searchText}
            onChangeText={setSearchText}
            placeholder="등록된 약 검색"
            placeholderTextColor="#6B7280"
            style={styles.searchInput}
          />
        </View>

        <View style={styles.emptyBox}>
          <Text style={styles.emptyTitle}>등록된 약이 없습니다.</Text>
          <Text style={styles.emptyDescription}>목록 위 등록 버튼을 눌러 복용약을 추가해 보세요.</Text>
        </View>
      </View>

      <View style={styles.candidateSection}>
        <Text style={styles.sectionTitle}>AI 판독 후보</Text>
        <Text style={styles.sectionDescription}>사진 판독 후 후보를 확인하고 복약 일정에 등록할 수 있습니다.</Text>
      </View>

      {pills.map((pill) => (
        <View key={pill.id} style={styles.resultCard}>
          <View style={styles.resultTop}>
            <View style={styles.pillIcon}>
              <MaterialCommunityIcons name="pill" size={26} color={colors.primary} />
            </View>
            <View style={styles.resultText}>
              <Text style={styles.resultTitle}>{pill.productName}</Text>
              <Text style={styles.resultMeta}>{pill.manufacturer} · {pill.ingredient}</Text>
            </View>
            <View style={styles.confidenceBadge}>
              <Text style={styles.confidenceText}>{Math.round(pill.confidence * 100)}%</Text>
            </View>
          </View>
          <Text style={styles.body}>{pill.shape} · {pill.color} · 식별문자 {pill.imprint}</Text>
          {pill.warnings.map((warning) => (
            <View key={warning} style={styles.warningRow}>
              <MaterialCommunityIcons name="alert-outline" size={18} color={noticeText} />
              <Text style={styles.warningText}>{warning}</Text>
            </View>
          ))}
          <View style={styles.resultActions}>
            <Pressable style={styles.primaryButton}>
              <MaterialCommunityIcons name="calendar-plus" size={18} color="#FFFFFF" />
              <Text style={styles.primaryButtonText}>복약 일정 등록</Text>
            </Pressable>
            <Pressable style={styles.secondaryButton}>
              <MaterialCommunityIcons name="information-outline" size={18} color={colors.primary} />
              <Text style={styles.secondaryButtonText}>상세보기</Text>
            </Pressable>
          </View>
        </View>
      ))}
    </AppScreen>
  );
}

function SegmentButton({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={[styles.segmentButton, active && styles.segmentButtonActive]}>
      <Text style={[styles.segmentText, active && styles.segmentTextActive]}>{label}</Text>
    </Pressable>
  );
}

function RegistrationTile({ title, description, icon, active = false }: { title: string; description: string; icon: keyof typeof MaterialCommunityIcons.glyphMap; active?: boolean }) {
  return (
    <Pressable style={[styles.tile, active && styles.tileActive]}>
      <MaterialCommunityIcons name={icon} size={34} color={active ? "#FFFFFF" : colors.primary} />
      <Text style={[styles.tileTitle, active && styles.tileTitleActive]}>{title}</Text>
      <Text style={[styles.tileDescription, active && styles.tileDescriptionActive]}>{description}</Text>
    </Pressable>
  );
}

const noticeText = "#A83B15";

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
  notice: {
    minHeight: 104,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#FDBA74",
    backgroundColor: "#FFF7ED",
    padding: spacing.md,
    flexDirection: "row",
    alignItems: "flex-start",
    gap: spacing.md
  },
  noticeText: {
    ...typography.body,
    flex: 1,
    color: noticeText,
    fontWeight: "800",
    lineHeight: 24
  },
  segmented: {
    minHeight: 62,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#C7D6EA",
    backgroundColor: colors.surfaceAlt,
    padding: spacing.xs,
    flexDirection: "row",
    gap: spacing.xs
  },
  segmentButton: {
    flex: 1,
    minHeight: 50,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center"
  },
  segmentButtonActive: {
    backgroundColor: colors.primary
  },
  segmentText: {
    ...typography.button,
    color: colors.primary,
    textAlign: "center"
  },
  segmentTextActive: {
    color: "#FFFFFF"
  },
  actionGrid: {
    flexDirection: "row",
    gap: spacing.sm
  },
  tile: {
    flex: 1,
    minHeight: 122,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#C7D6EA",
    backgroundColor: "#FFFFFF",
    padding: spacing.md,
    justifyContent: "space-between"
  },
  tileActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary
  },
  tileTitle: {
    ...typography.sectionTitle,
    color: colors.primary
  },
  tileTitleActive: {
    color: "#FFFFFF"
  },
  tileDescription: {
    ...typography.body,
    color: colors.text
  },
  tileDescriptionActive: {
    color: "#FFFFFF"
  },
  listCard: {
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: "#FFFFFF",
    padding: spacing.lg,
    gap: spacing.md
  },
  listHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.md
  },
  sectionTitle: {
    ...typography.title,
    color: colors.textStrong
  },
  addButton: {
    minWidth: 64,
    minHeight: 52,
    borderRadius: 8,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: spacing.md
  },
  addButtonText: {
    ...typography.button,
    color: "#FFFFFF"
  },
  searchBox: {
    minHeight: 62,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#C7D6EA",
    backgroundColor: "#FFFFFF",
    justifyContent: "center",
    paddingHorizontal: spacing.md
  },
  searchInput: {
    ...typography.bodyLarge,
    minHeight: 58,
    color: colors.textStrong
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
    ...typography.bodyLarge,
    color: colors.text
  },
  candidateSection: {
    gap: spacing.xs
  },
  sectionDescription: {
    ...typography.body,
    color: colors.text
  },
  resultCard: {
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: "#FFFFFF",
    padding: spacing.md,
    gap: spacing.sm
  },
  resultTop: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm
  },
  pillIcon: {
    width: 48,
    height: 48,
    borderRadius: 8,
    backgroundColor: colors.primarySoft,
    alignItems: "center",
    justifyContent: "center"
  },
  resultText: {
    flex: 1,
    gap: 2
  },
  resultTitle: {
    ...typography.sectionTitle,
    color: colors.textStrong
  },
  resultMeta: {
    ...typography.caption,
    color: colors.primaryStrong
  },
  confidenceBadge: {
    minHeight: 36,
    borderRadius: 8,
    backgroundColor: "#E8F5EE",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: spacing.sm
  },
  confidenceText: {
    ...typography.caption,
    color: colors.success,
    fontWeight: "800"
  },
  body: {
    ...typography.body,
    color: colors.text
  },
  warningRow: {
    borderRadius: 8,
    backgroundColor: "#FFF7ED",
    padding: spacing.sm,
    flexDirection: "row",
    gap: spacing.xs,
    alignItems: "flex-start"
  },
  warningText: {
    ...typography.caption,
    flex: 1,
    color: noticeText,
    lineHeight: 19
  },
  resultActions: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm
  },
  primaryButton: {
    minHeight: 48,
    borderRadius: 8,
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.md,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.xs
  },
  primaryButtonText: {
    ...typography.button,
    color: "#FFFFFF"
  },
  secondaryButton: {
    minHeight: 48,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.primary,
    backgroundColor: "#FFFFFF",
    paddingHorizontal: spacing.md,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.xs
  },
  secondaryButtonText: {
    ...typography.button,
    color: colors.primary
  }
});
