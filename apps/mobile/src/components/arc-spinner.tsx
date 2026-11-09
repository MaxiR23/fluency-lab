import { useEffect } from "react";
import type { ColorValue } from "react-native";
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from "react-native-reanimated";

import { Icon } from "@/components/icon";
import { size, strokeWidth } from "@/constants/theme";

// INFO: offline-retrying.html's spinner: one turn every .9 s, linear. With spin null it
// stands still, which is the reduce motion look.
export function ArcSpinner({ spin, color }: { spin: number | null; color: ColorValue }) {
  const rotation = useSharedValue(0);

  useEffect(() => {
    if (spin === null) return;
    rotation.set(withRepeat(withTiming(360, { duration: spin, easing: Easing.linear }), -1));
  }, [spin, rotation]);

  const turn = useAnimatedStyle(() => ({ transform: [{ rotate: `${rotation.get()}deg` }] }));

  return (
    <Animated.View
      testID="arc-spinner"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={turn}
    >
      <Icon name="arc" color={color} size={size.iconSpinner} strokeWidth={strokeWidth.spinner} />
    </Animated.View>
  );
}
