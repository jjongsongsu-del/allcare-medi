import { router } from "expo-router";
import { useEffect } from "react";
import { ActivityIndicator, StyleSheet, View } from "react-native";
import { useAuth } from "@/auth/AuthProvider";
import { LoginStartScreen } from "@/features/auth/LoginStartScreen";
import { colors } from "@/theme/colors";

export default function IndexScreen() {
  const { loading, session } = useAuth();

  useEffect(() => {
    if (!loading && session) {
      router.replace("/(tabs)");
    }
  }, [loading, session]);

  if (loading || session) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return <LoginStartScreen />;
}

const styles = StyleSheet.create({
  loading: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.background
  }
});
