import { useEffect } from "react";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withTiming,
} from "react-native-reanimated";

import { Icon } from "@/components/icon";
import { offlineBadgeStyle, type OfflineBadgeLook } from "@/components/offline-badge-style";
import { colors } from "@/constants/theme";
import { easing } from "@/utils/chat-transitions";
import type { OfflineMotion } from "@/utils/offline-motion";

// INFO: offline.html's rings grow and fade every 2.4 s on ease-out, the second one 1.2 s later. The CSS
// draws the second ring at scale 1 during its delay (no fill mode), which is an artifact of the canvas;
// here it rests at its start frame, scale .8, hidden behind the badge.
function Ring({
  delay,
  ring,
  style,
}: {
  delay: number;
  ring: OfflineMotion["ring"];
  style: ReturnType<typeof offlineBadgeStyle>["ring"];
}) {
  const scale = useSharedValue(ring.from);
  const opacity = useSharedValue(ring.opacity);

  useEffect(() => {
    const curve = easing(ring.curve);
    const loop = (to: number) =>
      withDelay(delay, withRepeat(withTiming(to, { duration: ring.cycle, easing: curve }), -1));
    scale.set(loop(ring.to));
    opacity.set(loop(0));
  }, [delay, ring, scale, opacity]);

  const animated = useAnimatedStyle(() => ({
    opacity: opacity.get(),
    transform: [{ scale: scale.get() }],
  }));

  return <Animated.View testID="offline-ring" style={[style, animated]} />;
}

// INFO: the crossed cloud of the can't-connect screens. The rings are drawn only on the large badge and
// only with motion: offline-inline.html has none, and reduce motion stands still.
export function OfflineBadge({
  look,
  motion,
}: {
  look: OfflineBadgeLook;
  motion: OfflineMotion | null;
}) {
  const style = offlineBadgeStyle(look);
  const rings = look === "large" && motion !== null ? motion.ring : null;
  const badge = (
    <Animated.View style={style.badge}>
      <Icon
        name="cloudOff"
        color={colors.accent}
        size={style.icon.size}
        strokeWidth={style.icon.strokeWidth}
      />
    </Animated.View>
  );
  return (
    <Animated.View
      testID="offline-badge"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={style.box}
    >
      {rings === null
        ? null
        : rings.delays.map((delay) => (
            <Ring key={delay} delay={delay} ring={rings} style={style.ring} />
          ))}
      {badge}
    </Animated.View>
  );
}
