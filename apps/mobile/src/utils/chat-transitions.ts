import {
  Easing,
  FadeIn,
  FadeInDown,
  FadeOut,
  Keyframe,
  SlideInDown,
  type ReanimatedKeyframe,
} from "react-native-reanimated";

import { motion } from "@/constants/theme";
import type { EnterMotion, FadeMotion, SheetMotion, TitleSwapMotion } from "@/utils/chat-motion";

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

// INFO: the old title fades up and out (chat-title.html swapOut), 6 points with ease-out.
export function titleOutTransition(swap: TitleSwapMotion | null): ReanimatedKeyframe | undefined {
  if (swap === null) return undefined;
  return new Keyframe({
    0: { opacity: 1, transform: [{ translateY: 0 }] },
    100: {
      opacity: 0,
      transform: [{ translateY: -swap.offset }],
      easing: easing(motion.easeOut),
    },
  }).duration(swap.outDuration);
}

// INFO: the new title rises in after the old one has started to leave (chat-title.html swapIn).
export function titleInTransition(swap: TitleSwapMotion | null): ReanimatedKeyframe | undefined {
  if (swap === null) return undefined;
  return new Keyframe({
    0: { opacity: 0, transform: [{ translateY: swap.offset }] },
    100: { opacity: 1, transform: [{ translateY: 0 }], easing: easing(motion.easeOut) },
  })
    .duration(swap.inDuration)
    .delay(swap.inDelay);
}

// INFO: the rename sheet rises from the bottom (chat-rename.html up); it has no exit in the file.
export function renameSheetTransition(sheet: SheetMotion | null): SlideInDown | undefined {
  if (sheet === null) return undefined;
  return SlideInDown.duration(sheet.duration).easing(easing(sheet.curve));
}
