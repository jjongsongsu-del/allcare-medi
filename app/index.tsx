import { router } from "expo-router";
import { Image, Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { colors } from "@/theme/colors";
import { spacing } from "@/theme/spacing";
import { typography } from "@/theme/typography";

export default function WelcomeScreen() {
  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.brandArea}>
        <Image source={require("../app_img/heal-si10.png")} style={styles.mascot} resizeMode="contain" />
        <Text style={styles.title}>올케어메디</Text>
        <Text style={styles.subtitle}>국민 누구나 쉽게 누리는 맞춤형 건강 길잡이</Text>
      </View>
      <Pressable style={styles.primaryButton} onPress={() => router.replace("/(tabs)")}>
        <Text style={styles.primaryButtonText}>시작하기</Text>
      </Pressable>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "space-between",
    padding: spacing.xl,
    backgroundColor: colors.background
  },
  brandArea: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.md
  },
  mascot: {
    width: 220,
    height: 220
  },
  title: {
    ...typography.display,
    color: colors.textStrong
  },
  subtitle: {
    ...typography.bodyLarge,
    color: colors.text,
    textAlign: "center"
  },
  primaryButton: {
    minHeight: 56,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 8,
    backgroundColor: colors.primary
  },
  primaryButtonText: {
    ...typography.button,
    color: colors.onPrimary
  }
});
