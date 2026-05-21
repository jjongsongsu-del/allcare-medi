import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Pressable, StyleSheet, Text } from "react-native";
import { colors } from "@/theme/colors";
import { spacing } from "@/theme/spacing";
import { typography } from "@/theme/typography";

type ActionButtonProps = {
  label: string;
  icon: keyof typeof MaterialCommunityIcons.glyphMap;
  tone?: "primary" | "secondary" | "danger";
  onPress?: () => void;
};

export function ActionButton({ label, icon, tone = "primary", onPress }: ActionButtonProps) {
  const isPrimary = tone === "primary";
  const isDanger = tone === "danger";
  return (
    <Pressable
      accessibilityRole="button"
      style={[styles.button, isPrimary && styles.primary, isDanger && styles.danger]}
      onPress={onPress}
    >
      <MaterialCommunityIcons name={icon} size={20} color={isPrimary || isDanger ? colors.onPrimary : colors.primary} />
      <Text style={[styles.label, (isPrimary || isDanger) && styles.labelOnColor]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    minHeight: 48,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.primary,
    paddingHorizontal: spacing.lg,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: spacing.sm,
    backgroundColor: colors.surface
  },
  primary: {
    backgroundColor: colors.primary
  },
  danger: {
    borderColor: colors.danger,
    backgroundColor: colors.danger
  },
  label: {
    ...typography.button,
    color: colors.primary
  },
  labelOnColor: {
    color: colors.onPrimary
  }
});
