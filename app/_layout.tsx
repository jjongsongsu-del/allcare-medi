import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { AuthProvider } from "@/auth/AuthProvider";
import { FamilyProfileProvider } from "@/family/FamilyProfileProvider";
import { AccessibilityProvider } from "@/theme/AccessibilityProvider";
import { colors } from "@/theme/colors";

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <AuthProvider>
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
      </AuthProvider>
    </SafeAreaProvider>
  );
}
