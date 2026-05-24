import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useState } from "react";
import { Image, Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import type { MenuHelpContent } from "@/help/menuHelp";
import { colors } from "@/theme/colors";
import { spacing } from "@/theme/spacing";
import { typography } from "@/theme/typography";

type Props = {
  content: MenuHelpContent;
};

export function MenuHelpButton({ content }: Props) {
  const [visible, setVisible] = useState(false);
  const isDanger = content.tone === "danger";
  const accent = isDanger ? colors.danger : colors.primary;

  return (
    <>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${content.title} 열기`}
        hitSlop={8}
        onPress={() => setVisible(true)}
        style={[styles.helpButton, isDanger && styles.helpButtonDanger]}
      >
        <MaterialCommunityIcons name="help" size={22} color={accent} />
      </Pressable>

      <Modal visible={visible} transparent animationType="fade" onRequestClose={() => setVisible(false)}>
        <View style={styles.backdrop}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <View style={[styles.headerIcon, { backgroundColor: isDanger ? "#FEE4E2" : colors.primarySoft }]}>
                <MaterialCommunityIcons name="help-circle-outline" size={24} color={accent} />
              </View>
              <View style={styles.headerText}>
                <Text style={styles.modalTitle}>{content.title}</Text>
                <Text style={styles.modalSubtitle}>{content.subtitle}</Text>
              </View>
              <Pressable accessibilityRole="button" accessibilityLabel="도움말 닫기" onPress={() => setVisible(false)} style={styles.closeButton}>
                <MaterialCommunityIcons name="close" size={22} color={colors.textStrong} />
              </Pressable>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.modalBody}>
              <Image source={content.image} style={styles.helpImage} resizeMode="contain" />
              {content.sections.map((section) => (
                <View key={section.title} style={styles.sectionRow}>
                  <View style={[styles.sectionIcon, { backgroundColor: isDanger ? "#FFF1F0" : "#EEF6FF" }]}>
                    <MaterialCommunityIcons name={section.icon} size={22} color={accent} />
                  </View>
                  <View style={styles.sectionText}>
                    <Text style={styles.sectionTitle}>{section.title}</Text>
                    <Text style={styles.sectionBody}>{section.body}</Text>
                  </View>
                </View>
              ))}
              <View style={[styles.footerNotice, isDanger && styles.footerNoticeDanger]}>
                <Text style={[styles.footerText, isDanger && styles.footerTextDanger]}>{content.footer}</Text>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  helpButton: {
    width: 48,
    height: 48,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: "#C7D6EA",
    backgroundColor: colors.surface,
    alignItems: "center",
    justifyContent: "center"
  },
  helpButtonDanger: {
    borderColor: "#FDA29B",
    backgroundColor: "#FFF7F6"
  },
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(17, 24, 39, 0.42)",
    padding: spacing.lg,
    justifyContent: "center"
  },
  modalCard: {
    maxHeight: "88%",
    borderRadius: 6,
    backgroundColor: colors.surface,
    overflow: "hidden"
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    padding: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border
  },
  headerIcon: {
    width: 48,
    height: 48,
    borderRadius: 4,
    alignItems: "center",
    justifyContent: "center"
  },
  headerText: {
    flex: 1
  },
  modalTitle: {
    ...typography.sectionTitle,
    color: colors.textStrong
  },
  modalSubtitle: {
    ...typography.caption,
    color: colors.textMuted,
    marginTop: 2
  },
  closeButton: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center"
  },
  modalBody: {
    padding: spacing.md,
    gap: spacing.md
  },
  helpImage: {
    width: "100%",
    height: 190,
    backgroundColor: colors.surfaceAlt
  },
  sectionRow: {
    flexDirection: "row",
    gap: spacing.md,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: "#FFFFFF"
  },
  sectionIcon: {
    width: 44,
    height: 44,
    borderRadius: 4,
    alignItems: "center",
    justifyContent: "center"
  },
  sectionText: {
    flex: 1,
    gap: 4
  },
  sectionTitle: {
    ...typography.bodyLarge,
    color: colors.textStrong,
    fontWeight: "800"
  },
  sectionBody: {
    ...typography.body,
    color: colors.text
  },
  footerNotice: {
    padding: spacing.md,
    borderWidth: 1,
    borderColor: "#B8D8F4",
    backgroundColor: colors.primarySoft
  },
  footerNoticeDanger: {
    borderColor: "#FDA29B",
    backgroundColor: "#FFF1F0"
  },
  footerText: {
    ...typography.caption,
    color: colors.primaryStrong
  },
  footerTextDanger: {
    color: "#B42318"
  }
});
