import { SlideInDown } from "react-native-reanimated";

import { easing } from "@/utils/chat-transitions";
import type { ExerciseMotion } from "@/utils/practice-motion";

// INFO: the feedback sheet rises from below the screen. After a miss it waits for the shake of the
// answer (exercise-not-quite.html), after a right answer for the pick (exercise-choose.html).
export function sheetTransition(
  sheet: ExerciseMotion["sheet"] | null,
  tone: "right" | "miss",
): SlideInDown | undefined {
  if (sheet === null) return undefined;
  return SlideInDown.duration(sheet.duration)
    .delay(tone === "right" ? sheet.delayRight : sheet.delayMiss)
    .easing(easing(sheet.curve));
}
