import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Tabs } from "expo-router";
import { colors } from "@/theme/colors";

const tabIconSize = 22;
const emergencyRed = "#D92D20";

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarStyle: {
          height: 62,
          paddingBottom: 8,
          paddingTop: 6,
          borderTopColor: colors.border,
          backgroundColor: colors.surface
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
