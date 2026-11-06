import { Tabs } from "expo-router/js-tabs";

import { Icon } from "@/components/icon";
import { TabBar } from "@/components/tab-bar";
import { colors } from "@/constants/theme";
import { useTabPillMotion } from "@/hooks/use-tab-pill-motion";

export default function TabsLayout() {
  const pill = useTabPillMotion();
  return (
    <Tabs
      tabBar={(props) => <TabBar {...props} pill={pill} />}
      screenOptions={{
        headerShown: false,
        sceneStyle: { backgroundColor: colors.background },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Home",
          tabBarButtonTestID: "tab-home",
          tabBarIcon: ({ color, size }) => <Icon name="home" color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="progress"
        options={{
          title: "Progress",
          tabBarButtonTestID: "tab-progress",
          tabBarIcon: ({ color, size }) => <Icon name="progress" color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: "Settings",
          tabBarButtonTestID: "tab-settings",
          tabBarIcon: ({ color, size }) => <Icon name="settings" color={color} size={size} />,
        }}
      />
    </Tabs>
  );
}
