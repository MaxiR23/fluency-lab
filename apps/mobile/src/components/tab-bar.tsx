import type { ReactNode } from "react";
import { type ColorValue, Pressable, StyleSheet, View } from "react-native";

import { tabBarStyle } from "@/components/tab-bar-style";
import { Text } from "@/components/text";
import { colors, size, spacing } from "@/constants/theme";

// INFO: the part of the navigator's tab bar props this bar reads. Expo Router's
// BottomTabBarProps is assignable to it.
type TabBarProps = {
  state: { index: number; routes: { key: string; name: string }[] };
  descriptors: Record<
    string,
    {
      options: {
        title?: string;
        tabBarButtonTestID?: string;
        tabBarIcon?: (props: { focused: boolean; color: ColorValue; size: number }) => ReactNode;
      };
    }
  >;
  emitter: {
    emit(event: { type: "tabPress"; target: string; canPreventDefault: true }): {
      defaultPrevented: boolean;
    };
  };
  navigateToTab(routeKey: string): void;
  insets: { bottom: number };
};

export function TabBar({ state, descriptors, emitter, navigateToTab, insets }: TabBarProps) {
  return (
    <View style={tabBarStyle(insets.bottom)}>
      {state.routes.map((route, index) => {
        const { options } = descriptors[route.key];
        const focused = index === state.index;
        const label = options.title ?? route.name;
        const content = (
          <>
            {options.tabBarIcon?.({
              focused,
              color: focused ? colors.accent : colors.textMuted,
              size: size.iconTab,
            })}
            <Text variant={focused ? "tabActive" : "tab"}>{label}</Text>
          </>
        );
        // INFO: the current tab is not pressable, so Home is not a link to itself.
        if (focused) {
          return (
            <View
              key={route.key}
              accessible
              accessibilityRole="tab"
              accessibilityLabel={label}
              accessibilityState={{ selected: true }}
              testID={options.tabBarButtonTestID}
              style={styles.item}
            >
              {content}
            </View>
          );
        }
        const onPress = () => {
          const event = emitter.emit({
            type: "tabPress",
            target: route.key,
            canPreventDefault: true,
          });
          if (!event.defaultPrevented) navigateToTab(route.key);
        };
        return (
          <Pressable
            key={route.key}
            accessibilityRole="tab"
            accessibilityLabel={label}
            accessibilityState={{ selected: false }}
            testID={options.tabBarButtonTestID}
            onPress={onPress}
            style={styles.item}
          >
            {content}
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  item: {
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.xs,
    minWidth: size.tabItem,
    minHeight: size.touch,
  },
});
