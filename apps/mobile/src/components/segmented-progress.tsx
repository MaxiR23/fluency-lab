import { useEffect } from "react";
import { StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";

import {
  segmentedProgressBar,
  segmentedProgressStyle,
  type SegmentedProgressLook,
  type SegmentState,
} from "@/components/segmented-progress-style";
import { easing } from "@/utils/chat-transitions";

type FillMotion = { duration: number; curve: readonly [number, number, number, number] };

// INFO: fill is the segment just answered: it fills from the left. With motion null it is drawn
// full, which is also the reduce motion look.
export function SegmentedProgress({
  segments,
  look,
  label,
  fill = null,
  style,
}: {
  segments: readonly SegmentState[];
  look: SegmentedProgressLook;
  label: string;
  fill?: { index: number; motion: FillMotion | null } | null;
  style?: StyleProp<ViewStyle>;
}) {
  const reached = segments.filter((state) => state !== "pending").length;
  return (
    <View
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel={label}
      accessibilityValue={{ min: 0, max: segments.length, now: reached }}
      style={[segmentedProgressBar(look), style]}
    >
      {segments.map((state, index) => {
        const filling = fill !== null && fill.index === index && look === "exercise";
        const base = segmentedProgressStyle(filling ? "pending" : state, look);
        return (
          <View key={index} testID="progress-segment" style={filling ? [base, styles.clip] : base}>
            {filling ? <Fill state={state} motion={fill.motion} /> : null}
          </View>
        );
      })}
    </View>
  );
}

function Fill({ state, motion }: { state: SegmentState; motion: FillMotion | null }) {
  const scale = useSharedValue(motion === null ? 1 : 0);

  useEffect(() => {
    if (motion === null) return;
    scale.set(withTiming(1, { duration: motion.duration, easing: easing(motion.curve) }));
  }, [motion, scale]);

  const animatedStyle = useAnimatedStyle(() => ({ transform: [{ scaleX: scale.get() }] }));

  return (
    <Animated.View
      testID="progress-fill"
      style={[
        styles.fill,
        { backgroundColor: segmentedProgressStyle(state, "exercise").backgroundColor },
        animatedStyle,
      ]}
    />
  );
}

const styles = StyleSheet.create({
  clip: { overflow: "hidden" },
  fill: { position: "absolute", inset: 0, transformOrigin: "left" },
});
