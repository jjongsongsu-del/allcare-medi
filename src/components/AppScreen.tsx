import { PropsWithChildren } from "react";
import { ScrollView, StyleProp, StyleSheet, ViewStyle } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { colors } from "@/theme/colors";
import { useDesignMode } from "@/theme/DesignModeProvider";
import { spacing } from "@/theme/spacing";

type AppScreenProps = PropsWithChildren<{
  contentStyle?: StyleProp<ViewStyle>;
}>;

export function AppScreen({ children, contentStyle }: AppScreenProps) {
  const { isDesignOne, isDesignTwo, isDesignThree } = useDesignMode();
  return (
    <SafeAreaView style={[styles.safeArea, isDesignOne && styles.designOneSafeArea, isDesignTwo && styles.designTwoSafeArea, isDesignThree && styles.designThreeSafeArea]} edges={["top"]}>
      <ScrollView contentContainerStyle={[styles.content, isDesignOne && styles.designOneContent, isDesignTwo && styles.designTwoContent, isDesignThree && styles.designThreeContent, contentStyle]} showsVerticalScrollIndicator={false}>
        {children}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background
  },
  designOneSafeArea: {
    backgroundColor: "#F7F3FF"
  },
  designTwoSafeArea: {
    backgroundColor: "#F3FBFF"
  },
  designThreeSafeArea: {
    backgroundColor: "#F8F4FF"
  },
  content: {
    padding: spacing.lg,
    paddingBottom: spacing.xxl,
    gap: spacing.lg
  },
  designOneContent: {
    backgroundColor: "#F7F3FF",
    gap: spacing.md
  },
  designTwoContent: {
    backgroundColor: "#F3FBFF",
    gap: spacing.md
  },
  designThreeContent: {
    backgroundColor: "#F8F4FF",
    gap: spacing.md
  }
});
