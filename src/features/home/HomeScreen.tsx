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
    gap: 20,
    paddingHorizontal: 20,
    backgroundColor: colors.background
  },
  hero: {
    minHeight: 250,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingTop: spacing.xl
  },
  heroCopy: {
    flex: 1,
    gap: 10
  },
  eyebrow: {
    fontSize: 28,
    lineHeight: 36,
    fontWeight: "900",
    color: colors.primary
  },
  logoTitle: {
    fontSize: 56,
    lineHeight: 66,
    fontWeight: "900",
    color: colors.textStrong
  },
  subtitle: {
    fontSize: 28,
    lineHeight: 36,
    fontWeight: "800",
    color: colors.text
  },
  mascot: {
    width: 148,
    height: 148
  },
  profileCard: {
    minHeight: 116,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: "#CAD7EE",
    backgroundColor: "#F8FBFF",
    paddingHorizontal: spacing.xl,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.lg
  },
  avatar: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: colors.primary
  },
  profileText: {
    flex: 1,
    gap: 4
  },
  profileName: {
    fontSize: 30,
    lineHeight: 38,
    fontWeight: "900",
    color: colors.textStrong
  },
  profileMeta: {
    fontSize: 20,
    lineHeight: 28,
    fontWeight: "800",
    color: colors.textMuted
  },
  searchCard: {
    borderRadius: 8,
    borderWidth: 2,
    borderColor: "#CAD7EE",
    backgroundColor: "#F8FBFF",
    padding: spacing.xl,
    gap: spacing.xl
  },
  cardTitle: {
    fontSize: 34,
    lineHeight: 42,
    fontWeight: "900",
    color: colors.textStrong
  },
  cardSubTitle: {
    fontSize: 20,
    lineHeight: 28,
    fontWeight: "800",
    color: colors.textMuted
  },
  searchBox: {
    minHeight: 74,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: "#CAD7EE",
    backgroundColor: colors.surface,
    flexDirection: "row",
    overflow: "hidden"
  },
  searchInput: {
    flex: 1,
    paddingHorizontal: spacing.xl,
    fontSize: 24,
    lineHeight: 32,
    fontWeight: "800",
    color: colors.textStrong
  },
  searchButton: {
    width: 150,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.primary
  },
  searchButtonText: {
    fontSize: 25,
    lineHeight: 32,
    fontWeight: "900",
    color: colors.onPrimary
  },
  aiCard: {
    borderRadius: 8,
    borderWidth: 2,
    borderColor: "#AAC7FF",
    backgroundColor: "#EAF2FF",
    padding: spacing.xl,
    gap: spacing.lg
  },
  aiText: {
    fontSize: 25,
    lineHeight: 36,
    fontWeight: "800",
    color: colors.text
  },
  primarySmallButton: {
    width: 170,
    minHeight: 68,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.primary
  },
  primarySmallButtonText: {
    fontSize: 25,
    lineHeight: 32,
    fontWeight: "900",
    color: colors.onPrimary
  },
  medicationCard: {
    borderRadius: 8,
    borderWidth: 2,
    borderColor: "#CAD7EE",
    backgroundColor: colors.surface,
    padding: spacing.xl,
    gap: spacing.xl
  },
  rowBetween: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.md
  },
  outlineMiniButton: {
    minWidth: 96,
    minHeight: 64,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: colors.primary,
    alignItems: "center",
    justifyContent: "center"
  },
  outlineMiniButtonText: {
    fontSize: 22,
    lineHeight: 30,
    fontWeight: "900",
    color: colors.primary
  },
  emptyMedication: {
    borderRadius: 8,
    borderWidth: 2,
    borderColor: "#DFE5EF",
    backgroundColor: "#F8FAFD",
    padding: spacing.xl,
    gap: spacing.sm
  },
  emptyTitle: {
    fontSize: 26,
    lineHeight: 34,
    fontWeight: "900",
    color: colors.textStrong
  },
  emptyText: {
    fontSize: 22,
    lineHeight: 32,
    fontWeight: "800",
    color: colors.textMuted
  },
  medicationButtons: {
    flexDirection: "row",
    gap: spacing.md
  },
  largePrimaryButton: {
    flex: 1,
    minHeight: 72,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.primary
  },
  largePrimaryButtonText: {
    fontSize: 25,
    lineHeight: 32,
    fontWeight: "900",
    color: colors.onPrimary
  },
  largeOutlineButton: {
    flex: 1,
    minHeight: 72,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.surface
  },
  largeOutlineButtonText: {
    fontSize: 25,
    lineHeight: 32,
    fontWeight: "900",
    color: colors.primary
  },
  secondaryGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm
  }
});
