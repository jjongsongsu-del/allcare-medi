import { MaterialCommunityIcons } from "@expo/vector-icons";
import { router } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useFamilyProfile } from "@/family/FamilyProfileProvider";
import { colors } from "@/theme/colors";
import { spacing } from "@/theme/spacing";
import { typography } from "@/theme/typography";

export function CurrentFamilyBanner({ compact = false }: { compact?: boolean }) {
  const { selectedProfile } = useFamilyProfile();
  const name = selectedProfile?.profileName ?? "나";
  const relation = relationLabel(selectedProfile?.relationType);

  return (
    <View style={[styles.container, compact && styles.compact]}>
      <MaterialCommunityIcons name="account-heart" size={compact ? 18 : 22} color={colors.primary} />
      <Text style={styles.text}>현재 대상: {name}</Text>
      <Text style={styles.meta}>{relation}</Text>
    </View>
  );
}

export function CurrentFamilyIconButton({ size = 48 }: { size?: number }) {
  const { selectedProfile } = useFamilyProfile();
  const name = selectedProfile?.profileName ?? "나";

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`현재 대상 ${name} 변경`}
      hitSlop={8}
      onPress={() => router.push("/(tabs)/family")}
      style={[styles.iconButton, { width: size, height: size }]}
    >
      <MaterialCommunityIcons name="account-heart-outline" size={Math.max(22, size - 24)} color={colors.textStrong} />
    </Pressable>
  );
}

function relationLabel(relation?: string | null) {
  if (relation === "SELF") return "본인";
  if (relation === "SPOUSE") return "배우자";
  if (relation === "CHILD") return "자녀";
  if (relation === "PARENT") return "부모님";
  return "가족";
}

const styles = StyleSheet.create({
  container: {
    minHeight: 48,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: colors.primary,
    backgroundColor: colors.primarySoft,
    paddingHorizontal: spacing.md,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm
  },
  compact: {
    minHeight: 40
  },
  text: {
    ...typography.button,
    color: colors.primaryStrong
  },
  meta: {
    ...typography.caption,
    color: colors.textMuted
  },
  iconButton: {
    borderRadius: 4,
    borderWidth: 1,
    borderColor: "#C7D6EA",
    backgroundColor: colors.surface,
    alignItems: "center",
    justifyContent: "center"
  }
});
