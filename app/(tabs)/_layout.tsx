import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Redirect, router, Tabs } from "expo-router";
import { useEffect } from "react";
import { ActivityIndicator, StyleSheet, View } from "react-native";
import { useAuth } from "@/auth/AuthProvider";
import { colors } from "@/theme/colors";
import { designOne } from "@/theme/designOne";
import { designTwo } from "@/theme/designTwo";
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
        tabBarActiveTintColor: isDesignOne || isDesignTwo ? "#FFFFFF" : colors.primary,
        tabBarInactiveTintColor: isDesignOne ? designOne.inactive : isDesignTwo ? "#FFFFFF" : colors.textMuted,
        tabBarActiveBackgroundColor: isDesignOne ? designOne.primary : undefined,
        tabBarShowLabel: !isDesignTwo,
        tabBarStyle: {
          height: isDesignTwo ? 62 : isDesignOne ? 76 : isDesignThree ? 68 : 62,
          paddingHorizontal: isDesignTwo ? 10 : isDesignOne ? 12 : 0,
          paddingBottom: isDesignTwo ? 8 : isDesignOne ? 12 : isDesignThree ? 10 : 8,
          paddingTop: isDesignTwo ? 8 : isDesignOne ? 10 : isDesignThree ? 8 : 6,
          marginHorizontal: isDesignTwo ? 30 : isDesignOne ? 24 : 0,
          marginBottom: isDesignTwo ? 12 : isDesignOne ? 14 : 0,
          borderRadius: isDesignTwo ? designTwo.radiusPill : isDesignOne ? designOne.radiusPill : 0,
          borderTopWidth: isDesignOne || isDesignTwo ? 0 : 1,
          borderTopColor: isDesignOne || isDesignTwo ? "transparent" : isDesignThree ? "#E4D7F7" : colors.border,
          backgroundColor: isDesignTwo ? designTwo.primary : isDesignOne || isDesignThree ? "#FFFFFF" : colors.surface,
          ...(isDesignOne ? designOne.shadow : {}),
          ...(isDesignTwo ? designTwo.shadow : {})
        },
        tabBarItemStyle: {
          borderRadius: isDesignTwo ? 22 : isDesignOne ? 24 : 0,
          marginHorizontal: isDesignOne || isDesignTwo ? 2 : 0,
          marginVertical: isDesignOne || isDesignTwo ? 6 : 0,
          overflow: "hidden"
        },
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: "800"
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
          tabBarActiveTintColor: isDesignOne || isDesignTwo ? "#FFFFFF" : emergencyRed,
          tabBarIcon: ({ focused }) => <MaterialCommunityIcons name="hospital-box" size={tabIconSize} color={(isDesignOne || isDesignTwo) && focused ? "#FFFFFF" : isDesignTwo ? "#FFFFFF" : emergencyRed} />
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
