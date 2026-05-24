import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useEffect } from "react";
import { Text, TextInput } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { AuthProvider } from "@/auth/AuthProvider";
import { ExperienceModeProvider } from "@/experience/ExperienceModeProvider";
import { FamilyProfileProvider } from "@/family/FamilyProfileProvider";
import { configureMedicationNotificationHandler } from "@/services/medicationNotificationService";
import { AccessibilityProvider } from "@/theme/AccessibilityProvider";
import { colors } from "@/theme/colors";

const scaledText = Text as typeof Text & { defaultProps?: Record<string, unknown> };
const scaledTextInput = TextInput as typeof TextInput & { defaultProps?: Record<string, unknown> };

scaledText.defaultProps = scaledText.defaultProps ?? {};
scaledText.defaultProps.maxFontSizeMultiplier = 1.08;
scaledTextInput.defaultProps = scaledTextInput.defaultProps ?? {};
scaledTextInput.defaultProps.maxFontSizeMultiplier = 1.08;

export default function RootLayout() {
  useEffect(() => {
    configureMedicationNotificationHandler();
  }, []);

  return (
    <SafeAreaProvider>
      <AuthProvider>
        <ExperienceModeProvider>
          <FamilyProfileProvider>
            <AccessibilityProvider>
              <StatusBar style="dark" backgroundColor={colors.background} />
              <Stack
                screenOptions={{
                  headerShown: false,
                  contentStyle: { backgroundColor: colors.background }
                }}
              />
            </AccessibilityProvider>
          </FamilyProfileProvider>
        </ExperienceModeProvider>
      </AuthProvider>
    </SafeAreaProvider>
  );
}
