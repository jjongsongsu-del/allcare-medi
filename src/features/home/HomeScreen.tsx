import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Image, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { AppScreen } from "@/components/AppScreen";
import { ActionButton } from "@/components/ActionButton";
import { KrdsCard } from "@/components/KrdsCard";
import { SectionHeader } from "@/components/SectionHeader";
import { colors } from "@/theme/colors";
import { spacing } from "@/theme/spacing";
import { typography } from "@/theme/typography";
import { useAccessibilitySettings } from "@/theme/AccessibilityProvider";

const quickActions = [
  { label: "AI 알약", icon: "camera-outline" as const },
  { label: "주변 약국", icon: "map-marker-radius-outline" as const },
  { label: "건강백과", icon: "book-open-page-variant-outline" as const },
  { label: "응급실", icon: "hospital-box-outline" as const }
];

export function HomeScreen() {
  const { highContrast, largeText, toggleHighContrast, toggleLargeText } = useAccessibilitySettings();

  return (
    <AppScreen>
      <View style={styles.hero}>
        <Image source={require("../../../app_img/allcaremedi.png")} style={styles.heroImage} resizeMode="contain" />
        <View style={styles.heroText}>
          <Text style={styles.greeting}>헬시가 도와드릴게요</Text>
          <Text style={styles.title}>무엇을 찾고 계신가요?</Text>
        </View>
      </View>

      <View style={styles.searchBox}>
        <MaterialCommunityIcons name="magnify" size={24} color={colors.primary} />
        <TextInput
          accessibilityLabel="통합 검색"
          placeholder="질병, 약품, 병원, 증상을 검색"
          placeholderTextColor={colors.textMuted}
          style={styles.searchInput}
        />
        <Pressable accessibilityRole="button" style={styles.iconButton}>
          <MaterialCommunityIcons name="camera-outline" size={22} color={colors.onPrimary} />
        </Pressable>
      </View>

      <View style={styles.quickGrid}>
        {quickActions.map((item) => (
          <Pressable key={item.label} style={styles.quickItem} accessibilityRole="button">
            <MaterialCommunityIcons name={item.icon} size={26} color={colors.primary} />
            <Text style={styles.quickLabel}>{item.label}</Text>
          </Pressable>
        ))}
      </View>

      <KrdsCard>
        <SectionHeader title="접근성 설정" description="고령층과 저시력 사용자를 위한 표시 옵션입니다." />
        <View style={styles.buttonRow}>
          <ActionButton label={largeText ? "큰 글자 켜짐" : "큰 글자"} icon="format-size" tone="secondary" onPress={toggleLargeText} />
          <ActionButton label={highContrast ? "고대비 켜짐" : "고대비"} icon="contrast-circle" tone="secondary" onPress={toggleHighContrast} />
        </View>
      </KrdsCard>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  hero: {
    minHeight: 180,
    borderRadius: 8,
    backgroundColor: colors.primarySoft,
    padding: spacing.lg,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.lg
  },
  heroImage: {
    width: 104,
    height: 104
  },
  heroText: {
    flex: 1,
    gap: spacing.xs
  },
  greeting: {
    ...typography.caption,
    color: colors.primaryStrong
  },
  title: {
    ...typography.title,
    color: colors.textStrong
  },
  searchBox: {
    minHeight: 60,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: colors.primary,
    paddingHorizontal: spacing.md,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm
  },
  searchInput: {
    flex: 1,
    ...typography.bodyLarge,
    color: colors.textStrong
  },
  iconButton: {
    width: 40,
    height: 40,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.primary
  },
  quickGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.md
  },
  quickItem: {
    width: "47%",
    minHeight: 88,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
    backgroundColor: colors.surface
  },
  quickLabel: {
    ...typography.body,
    color: colors.textStrong
  },
  buttonRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm
  }
});
