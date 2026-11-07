import { useEffect } from "react";
import { StyleSheet } from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from "react-native-reanimated";
import Svg, { Defs, Ellipse, LinearGradient, Path, RadialGradient, Stop } from "react-native-svg";

import { colors, gradient, motion as tokens, shadow, size, spacing } from "@/constants/theme";
import { easing } from "@/utils/chat-transitions";
import { flickSteps, type FlameMotion, type Step } from "@/utils/practice-motion";

// INFO: the perfect day of the week strip (home-perfect-day.html). With flick null the
// flame is still: that is also the reduce motion look.
export function Flame({ flick }: { flick: FlameMotion | null }) {
  const scaleX = useSharedValue(1);
  const scaleY = useSharedValue(1);
  const skew = useSharedValue(0);

  useEffect(() => {
    if (flick === null) return;
    const curve = easing(tokens.easeInOut);
    const loop = (steps: Step[]) =>
      withRepeat(
        withSequence(
          ...steps.map((step) => withTiming(step.to, { duration: step.duration, easing: curve })),
        ),
        -1,
      );
    const steps = flickSteps(flick);
    scaleX.set(loop(steps.scaleX));
    scaleY.set(loop(steps.scaleY));
    skew.set(loop(steps.skewX));
  }, [flick, scaleX, scaleY, skew]);

  const flickStyle = useAnimatedStyle(() => ({
    transform: [{ scaleX: scaleX.get() }, { scaleY: scaleY.get() }, { skewX: `${skew.get()}deg` }],
  }));

  return (
    <Animated.View
      testID="flame"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[styles.flame, shadow.flameGlow, flickStyle]}
    >
      <Svg
        width={size.flameWidth}
        height={size.flameHeight}
        viewBox="0 0 32 40"
        preserveAspectRatio="none"
      >
        <Defs>
          <LinearGradient id="flameBody" x1="0" y1="0" x2="0" y2="1">
            {gradient.flameBody.map((stop) => (
              <Stop key={stop.offset} offset={stop.offset} stopColor={stop.color} />
            ))}
          </LinearGradient>
          <LinearGradient id="flameCore" x1="0" y1="0" x2="0" y2="1">
            {gradient.flameCore.map((stop) => (
              <Stop key={stop.offset} offset={stop.offset} stopColor={stop.color} />
            ))}
          </LinearGradient>
          <RadialGradient id="flameHighlight" cx="0.36" cy="0.6" r="0.5">
            {gradient.flameHighlight.map((stop) => (
              <Stop
                key={stop.offset}
                offset={stop.offset}
                stopColor={stop.color}
                stopOpacity={stop.opacity}
              />
            ))}
          </RadialGradient>
        </Defs>
        <Path
          testID="flame-body"
          d="M16 1C18 8 27 12 27 24C27 32 22 38 16 38C10 38 5 32 5 24C5 17 9 13 11 9C12 14 14 16 16 17C15 11 15 6 16 1Z"
          fill="url(#flameBody)"
        />
        <Path
          testID="flame-shade"
          d="M27 24C27 32 22 38 16 38C20 35 23 30 22 23C21.5 18 19 15 18 11C22 14 27 17 27 24Z"
          fill={colors.flameShade}
        />
        <Path
          testID="flame-core"
          d="M16 14C17 19 22 22 22 28C22 33 19 36 16 36C13 36 10 33 10 28C10 24 12 22 13 20C14 23 15 24 16 25C15.5 21 15.5 17 16 14Z"
          fill="url(#flameCore)"
        />
        <Ellipse
          testID="flame-highlight"
          cx="12.5"
          cy="26"
          rx="5"
          ry="8"
          fill="url(#flameHighlight)"
        />
      </Svg>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  flame: {
    width: size.flameWidth,
    height: size.flameHeight,
    marginBottom: -spacing.tight,
    transformOrigin: tokens.flame.origin,
  },
});
