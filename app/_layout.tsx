import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { AuthProvider } from "@/auth/AuthProvider";
import { AccessibilityProvider } from "@/theme/AccessibilityProvider";
import { colors } from "@/theme/colors";

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <AuthProvider>
        <AccessibilityProvider>
          <StatusBar style="dark" backgroundColor={colors.background} />
          <Stack
            screenOptions={{
              headerShown: false,
              contentStyle: { backgroundColor: colors.background }
            }}
          />
        </AccessibilityProvider>
      </AuthProvider>
    </SafeAreaProvider>
  );
}
