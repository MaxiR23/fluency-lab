import type { ViewStyle } from "react-native";

import { colors, radius, size, spacing } from "@/constants/theme";

export type SegmentState = "done" | "missed" | "current" | "pending";
export type SegmentedProgressLook = "exercise" | "step";

export function segmentedProgressBar(look: SegmentedProgressLook): ViewStyle {
  return { flexDirection: "row", gap: look === "exercise" ? spacing.stack : spacing.xs };
}

// INFO: the exercise look is the 6 high rounded bar of the exercise files; the step look is the
// 4 high square bar the onboarding drew before it moved here, with the same values.
export function segmentedProgressStyle(
  state: SegmentState,
  look: SegmentedProgressLook,
): ViewStyle {
  if (look === "step") {
    return {
      flex: 1,
      height: size.progressBar,
      backgroundColor: state === "done" ? colors.accent : colors.border,
    };
  }
  return {
    flex: 1,
    height: size.segment,
    borderRadius: radius.segment,
    backgroundColor:
      state === "done" ? colors.accent : state === "missed" ? colors.miss : colors.border,
  };
}
