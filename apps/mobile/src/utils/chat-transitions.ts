import { Easing, FadeIn, FadeInDown, FadeOut } from "react-native-reanimated";

import { motion } from "@/constants/theme";
import type { EnterMotion, FadeMotion } from "@/utils/chat-motion";

export function easing(points: readonly [number, number, number, number]) {
  return Easing.bezier(...points);
}

export function enterTransition(enter: EnterMotion | null): FadeInDown | undefined {
  if (enter === null) return undefined;
  const built = FadeInDown.duration(enter.duration)
    .easing(easing(enter.curve ?? motion.easeOut))
    .withInitialValues({ translateY: enter.offset });
  return enter.delay === undefined ? built : built.delay(enter.delay);
}

export function fadeInTransition(fade: FadeMotion | null): FadeIn | undefined {
  if (fade === null) return undefined;
  return FadeIn.duration(fade.duration).easing(easing(motion.easeOut));
}

export function fadeOutTransition(fade: FadeMotion | null): FadeOut | undefined {
  if (fade === null) return undefined;
  return FadeOut.duration(fade.duration).easing(easing(motion.easeOut));
}
