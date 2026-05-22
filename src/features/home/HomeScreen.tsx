import { MaterialCommunityIcons } from "@expo/vector-icons";
import { router } from "expo-router";
import { Image, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { AppScreen } from "@/components/AppScreen";
import { ActionButton } from "@/components/ActionButton";
import { useAuth } from "@/auth/AuthProvider";
import { useFamilyProfile } from "@/family/FamilyProfileProvider";
import { colors } from "@/theme/colors";
import { spacing } from "@/theme/spacing";
import { typography } from "@/theme/typography";

export function HomeScreen() {
  const { session } = useAuth();
  const { selectedProfile } = useFamilyProfile();
  const displayName = selectedProfile?.profileName ?? (session?.mode === "guest" ? "비회원" : "나");
  const accountLabel = session?.mode === "member" ? session.nickname ?? "회원" : "비회원";

  return (
    <AppScreen contentStyle={styles.screen}>
      <View style={styles.hero}>
        <View style={styles.heroCopy}>
          <Text style={styles.eyebrow}>전국 어디서나</Text>
          <Text style={styles.logoTitle}>올케어메디</Text>
          <Text style={styles.subtitle}>내 손안의 가족 주치의</Text>
        </View>
        <Image source={require("../../../app_img/allcaremedi.png")} style={styles.mascot} resizeMode="contain" />
      </View>

      <Pressable style={styles.profileCard} onPress={() => router.push("/(tabs)/family")}>
        <View style={styles.avatar} />
        <View style={styles.profileText}>
          <Text style={styles.profileName}>{displayName}</Text>
          <Text style={styles.profileMeta}>{accountLabel}</Text>
        </View>
        <MaterialCommunityIcons name="chevron-right" size={28} color={colors.textMuted} />
      </Pressable>

      <View style={styles.searchCard}>
        <Text style={styles.cardTitle}>통합검색</Text>
        <View style={styles.searchBox}>
          <TextInput
            accessibilityLabel="통합 검색"
            placeholder="약품, 약국, 병원명을 검색하세요"
            placeholderTextColor={colors.textMuted}
            style={styles.searchInput}
          />
          <Pressable accessibilityRole="button" style={styles.searchButton}>
            <Text style={styles.searchButtonText}>검색</Text>
          </Pressable>
        </View>
      </View>

      <View style={styles.aiCard}>
        <Text style={styles.cardTitle}>AI 약 판독</Text>
        <Text style={styles.aiText}>촬영한 약과 유사한 후보를 찾고, 복용 전 약사 또는 의사 확인으로 연결합니다.</Text>
        <Pressable style={styles.primarySmallButton} onPress={() => router.push("/(tabs)/pills")}>
          <Text style={styles.primarySmallButtonText}>판독 시작</Text>
        </Pressable>
      </View>

      <View style={styles.medicationCard}>
        <View style={styles.rowBetween}>
          <View>
            <Text style={styles.cardTitle}>오늘 복약 스케줄</Text>
            <Text style={styles.cardSubTitle}>남은 복용 0건</Text>
          </View>
          <Pressable style={styles.outlineMiniButton} onPress={() => router.push("/(tabs)/medication")}>
            <Text style={styles.outlineMiniButtonText}>관리</Text>
          </Pressable>
        </View>

        <View style={styles.emptyMedication}>
          <Text style={styles.emptyTitle}>등록된 복용약이 없습니다.</Text>
          <Text style={styles.emptyText}>약 판독 결과나 직접 입력으로 내 약통을 시작해 보세요.</Text>
        </View>

        <View style={styles.medicationButtons}>
          <Pressable style={styles.largePrimaryButton} onPress={() => router.push("/(tabs)/medication")}>
            <Text style={styles.largePrimaryButtonText}>약관리</Text>
          </Pressable>
          <Pressable style={styles.largeOutlineButton} onPress={() => router.push("/(tabs)/medication")}>
            <Text style={styles.largeOutlineButtonText}>복용등록</Text>
          </Pressable>
        </View>
      </View>

      <View style={styles.secondaryGrid}>
        <ActionButton label="병원약국" icon="hospital-building" tone="secondary" onPress={() => router.push("/(tabs)/map")} />
        <ActionButton label="가족관리" icon="account-heart" tone="secondary" onPress={() => router.push("/(tabs)/family")} />
        <ActionButton label="응급카드" icon="card-account-details-star-outline" tone="secondary" onPress={() => router.push("/(tabs)/emergency")} />
        <ActionButton label="API 관리자" icon="api" tone="secondary" onPress={() => router.push("/admin/apis")} />
      </View>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  screen: {
    gap: spacing.md,
    paddingHorizontal: 20,
    backgroundColor: colors.background
  },
  hero: {
    minHeight: 168,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingTop: spacing.lg
  },
  heroCopy: {
    flex: 1,
    gap: 6
  },
  eyebrow: {
    ...typography.caption,
    fontWeight: "800",
    color: colors.primary
  },
  logoTitle: {
    ...typography.title,
    color: colors.textStrong
  },
  subtitle: {
    ...typography.body,
    color: colors.text
  },
  mascot: {
    width: 96,
    height: 96
  },
  profileCard: {
    minHeight: 84,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: "#CAD7EE",
    backgroundColor: "#F8FBFF",
    paddingHorizontal: spacing.lg,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md
  },
  avatar: {
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: colors.primary
  },
  profileText: {
    flex: 1,
    gap: 4
  },
  profileName: {
    ...typography.sectionTitle,
    color: colors.textStrong
  },
  profileMeta: {
    ...typography.caption,
    color: colors.textMuted
  },
  searchCard: {
    borderRadius: 8,
    borderWidth: 2,
    borderColor: "#CAD7EE",
    backgroundColor: "#F8FBFF",
    padding: spacing.lg,
    gap: spacing.md
  },
  cardTitle: {
    ...typography.sectionTitle,
    color: colors.textStrong
  },
  cardSubTitle: {
    ...typography.caption,
    color: colors.textMuted
  },
  searchBox: {
    minHeight: 58,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: "#CAD7EE",
    backgroundColor: colors.surface,
    flexDirection: "row",
    overflow: "hidden"
  },
  searchInput: {
    flex: 1,
    paddingHorizontal: spacing.lg,
    ...typography.body,
    color: colors.textStrong
  },
  searchButton: {
    width: 104,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.primary
  },
  searchButtonText: {
    ...typography.button,
    color: colors.onPrimary
  },
  aiCard: {
    borderRadius: 8,
    borderWidth: 2,
    borderColor: "#AAC7FF",
    backgroundColor: "#EAF2FF",
    padding: spacing.lg,
    gap: spacing.md
  },
  aiText: {
    ...typography.body,
    color: colors.text
  },
  primarySmallButton: {
    width: 132,
    minHeight: 52,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.primary
  },
  primarySmallButtonText: {
    ...typography.button,
    color: colors.onPrimary
  },
  medicationCard: {
    borderRadius: 8,
    borderWidth: 2,
    borderColor: "#CAD7EE",
    backgroundColor: colors.surface,
    padding: spacing.lg,
    gap: spacing.md
  },
  rowBetween: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.md
  },
  outlineMiniButton: {
    minWidth: 76,
    minHeight: 48,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: colors.primary,
    alignItems: "center",
    justifyContent: "center"
  },
  outlineMiniButtonText: {
    ...typography.button,
    color: colors.primary
  },
  emptyMedication: {
    borderRadius: 8,
    borderWidth: 2,
    borderColor: "#DFE5EF",
    backgroundColor: "#F8FAFD",
    padding: spacing.lg,
    gap: spacing.sm
  },
  emptyTitle: {
    ...typography.sectionTitle,
    color: colors.textStrong
  },
  emptyText: {
    ...typography.body,
    color: colors.textMuted
  },
  medicationButtons: {
    flexDirection: "row",
    gap: spacing.md
  },
  largePrimaryButton: {
    flex: 1,
    minHeight: 52,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.primary
  },
  largePrimaryButtonText: {
    ...typography.button,
    color: colors.onPrimary
  },
  largeOutlineButton: {
    flex: 1,
    minHeight: 52,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.surface
  },
  largeOutlineButtonText: {
    ...typography.button,
    color: colors.primary
  },
  secondaryGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm
  }
});
