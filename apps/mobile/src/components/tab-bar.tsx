import { type ReactNode, useEffect, useState } from "react";
import { type ColorValue, type LayoutChangeEvent, Pressable, StyleSheet, View } from "react-native";
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from "react-native-reanimated";

import { tabBarStyle, tabPillStyle } from "@/components/tab-bar-style";
import { Text } from "@/components/text";
import { colors, size, spacing } from "@/constants/theme";
import { type PillMotion, pillOffset, pillWidth } from "@/utils/tab-bar";

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

export function TabBar({
  state,
  descriptors,
  emitter,
  navigateToTab,
  insets,
  pill,
  onTabPress,
}: TabBarProps & { pill: PillMotion | null; onTabPress?: () => void }) {
  const count = state.routes.length;
  const [rowWidth, setRowWidth] = useState(0);
  const target = pillOffset(state.index, rowWidth, count);
  const offset = useSharedValue(target);
  const slide = useAnimatedStyle(() => ({ transform: [{ translateX: offset.get() }] }));
  useEffect(() => {
    if (pill !== null) offset.set(withSpring(target, pill));
  }, [offset, pill, target]);
  // INFO: a new row width places the pill without the spring; only a tab change slides it.
  const onLayout = (event: LayoutChangeEvent) => {
    const { width } = event.nativeEvent.layout;
    offset.set(pillOffset(state.index, width, count));
    setRowWidth(width);
  };
  return (
    <View style={tabBarStyle(insets.bottom)}>
      <View testID="tab-bar-row" style={styles.row} onLayout={onLayout}>
        <Animated.View
          testID="tab-pill"
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
          style={[
            tabPillStyle(pillWidth(rowWidth, count), pill === null ? target : null),
            pill === null ? null : slide,
          ]}
        />
        {state.routes.map((route, index) => {
          const { options } = descriptors[route.key];
          const focused = index === state.index;
          const label = options.title ?? route.name;
          const content = (
            <>
              {options.tabBarIcon?.({
                focused,
                color: focused ? colors.text : colors.textMuted,
                size: size.icon,
              })}
              <Text variant={focused ? "tabSelected" : "tab"}>{label}</Text>
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
            onTabPress?.();
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
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center" },
  item: {
    flex: 1,
    height: size.control,
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.tight,
  },
});
