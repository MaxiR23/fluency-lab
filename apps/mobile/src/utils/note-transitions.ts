import { FadeInLeft, Keyframe, type ReanimatedKeyframe } from "react-native-reanimated";

import { motion } from "@/constants/theme";
import type { SavedMotion } from "@/utils/chat-motion";
import { easing } from "@/utils/chat-transitions";
import type { RowMotion } from "@/utils/note-motion";

// INFO: a row of the note slides in from the left (note.html), after its own delay.
export function rowTransition(row: RowMotion | null): FadeInLeft | undefined {
  if (row === null) return undefined;
  return FadeInLeft.duration(row.duration)
    .delay(row.delay)
    .easing(easing(motion.easeOut))
    .withInitialValues({ translateX: row.offset });
}

// INFO: Saved to Notes grows from 0.8 while it fades in (note-in-chat.html). ZoomIn animates only
// the scale, so a Keyframe carries both.
export function savedTransition(saved: SavedMotion | null): ReanimatedKeyframe | undefined {
  if (saved === null) return undefined;
  return new Keyframe({
    0: { opacity: 0, transform: [{ scale: saved.scale }] },
    100: { opacity: 1, transform: [{ scale: 1 }], easing: easing(motion.easeOut) },
  })
    .duration(saved.duration)
    .delay(saved.delay);
}
