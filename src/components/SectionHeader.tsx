import { StyleSheet, Text, View } from "react-native";
import { colors } from "@/theme/colors";
import { designOne } from "@/theme/designOne";
import { useDesignMode } from "@/theme/DesignModeProvider";
import { typography } from "@/theme/typography";

type SectionHeaderProps = {
  title: string;
  description?: string;
};

export function SectionHeader({ title, description }: SectionHeaderProps) {
  const { isDesignOne } = useDesignMode();
  return (
    <View style={[styles.container, isDesignOne && styles.designOneContainer]}>
      <Text style={[styles.title, isDesignOne && styles.designOneTitle]}>{title}</Text>
      {description ? <Text style={[styles.description, isDesignOne && styles.designOneDescription]}>{description}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 4
  },
  title: {
    ...typography.sectionTitle,
    color: colors.textStrong
  },
  description: {
    ...typography.body,
    color: colors.textMuted
  },
  designOneContainer: {
    paddingHorizontal: 2
  },
  designOneTitle: {
    color: designOne.text,
    fontWeight: "900"
  },
  designOneDescription: {
    color: designOne.muted
  }
});
