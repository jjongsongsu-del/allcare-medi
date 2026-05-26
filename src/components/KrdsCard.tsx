import { PropsWithChildren } from "react";
import { StyleSheet, View } from "react-native";
import { colors } from "@/theme/colors";
import { designOne } from "@/theme/designOne";
import { designThree } from "@/theme/designThree";
import { designTwo } from "@/theme/designTwo";
import { useDesignMode } from "@/theme/DesignModeProvider";
import { spacing } from "@/theme/spacing";

export function KrdsCard({ children }: PropsWithChildren) {
  const { isDesignOne, isDesignTwo, isDesignThree } = useDesignMode();
  return <View style={[styles.card, isDesignOne && styles.designOneCard, isDesignTwo && styles.designTwoCard, isDesignThree && styles.designThreeCard]}>{children}</View>;
}

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 4,
    padding: spacing.lg,
    backgroundColor: colors.surface,
    gap: spacing.sm
  },
  designOneCard: {
    borderWidth: 0,
    borderRadius: designOne.radiusCard,
    backgroundColor: designOne.surface,
    padding: spacing.lg,
    ...designOne.shadow
  },
  designTwoCard: {
    borderWidth: 0,
    borderRadius: designTwo.radiusCard,
    backgroundColor: designTwo.cardSoft,
    ...designTwo.shadow
  },
  designThreeCard: {
    borderWidth: 0,
    borderRadius: designThree.radiusTile,
    backgroundColor: designThree.surface,
    padding: spacing.lg,
    ...designThree.shadow
  }
});
