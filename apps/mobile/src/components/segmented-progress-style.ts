import type { ViewStyle } from "react-native";

import { colors, radius, size, spacing } from "@/constants/theme";

export type SegmentState = "done" | "missed" | "current" | "pending";
export type SegmentedProgressLook = "exercise" | "step";

// INFO: the exercise bar sits in the exercise header row and takes its leftover width (flex 1 is
// basis 0 in React Native, so the bar never starts wider than the row); the step bar sits in a
// column and takes no flex.
export function segmentedProgressBar(look: SegmentedProgressLook): ViewStyle {
  if (look === "exercise") {
    return { flexDirection: "row", gap: spacing.stack, flex: 1, minWidth: 0 };
  }
  return { flexDirection: "row", gap: spacing.xs };
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
