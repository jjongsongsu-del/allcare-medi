import { MaterialCommunityIcons } from "@expo/vector-icons";
import { StyleSheet, Text, View } from "react-native";
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
    borderRadius: 8,
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
  }
});
