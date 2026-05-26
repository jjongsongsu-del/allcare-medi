import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Redirect, router, Tabs } from "expo-router";
import { useEffect } from "react";
import { ActivityIndicator, StyleSheet, View } from "react-native";
import { useAuth } from "@/auth/AuthProvider";
import { colors } from "@/theme/colors";
import { useDesignMode } from "@/theme/DesignModeProvider";

const tabIconSize = 22;
const emergencyRed = "#D92D20";

export default function TabLayout() {
  const { loading, session } = useAuth();
  const { isDesignOne, isDesignTwo, isDesignThree } = useDesignMode();

  useEffect(() => {
    if (!loading && !session) {
      router.replace("/");
    }
  }, [loading, session]);

  if (loading) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  if (!session) {
    return <Redirect href="/" />;
  }

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarStyle: {
          height: isDesignOne || isDesignTwo || isDesignThree ? 68 : 62,
          paddingBottom: isDesignOne || isDesignTwo || isDesignThree ? 10 : 8,
          paddingTop: isDesignOne || isDesignTwo || isDesignThree ? 8 : 6,
          borderTopColor: isDesignOne ? "#E7DDF8" : isDesignTwo ? "#D6EEF6" : isDesignThree ? "#E4D7F7" : colors.border,
          backgroundColor: isDesignOne || isDesignTwo || isDesignThree ? "#FFFFFF" : colors.surface
        },
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: "700"
        }
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "홈",
          tabBarIcon: ({ color }) => <MaterialCommunityIcons name="home-variant" size={tabIconSize} color={color} />
        }}
      />
      <Tabs.Screen
        name="pills"
        options={{
          title: "알약",
          tabBarIcon: ({ color }) => <MaterialCommunityIcons name="pill" size={tabIconSize} color={color} />
        }}
      />
      <Tabs.Screen
        name="medication"
        options={{
          title: "복약",
          tabBarIcon: ({ color }) => <MaterialCommunityIcons name="calendar-check" size={tabIconSize} color={color} />
        }}
      />
      <Tabs.Screen
        name="map"
        options={{
          title: "병원약국",
          tabBarIcon: ({ color }) => <MaterialCommunityIcons name="map-marker-radius" size={tabIconSize} color={color} />
        }}
      />
      <Tabs.Screen
        name="emergency"
        options={{
          title: "응급",
          tabBarActiveTintColor: emergencyRed,
          tabBarIcon: () => <MaterialCommunityIcons name="hospital-box" size={tabIconSize} color={emergencyRed} />
        }}
      />
      <Tabs.Screen
        name="family"
        options={{
          title: "메뉴",
          tabBarIcon: ({ color }) => <MaterialCommunityIcons name="view-grid-outline" size={tabIconSize} color={color} />
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  loading: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.background
  }
});
