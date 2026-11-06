import type { TextStyle, ViewStyle } from "react-native";

import { buttonStyle } from "@/components/button-style";
import { spacing } from "@/constants/theme";

export function quickAskRowStyle(): ViewStyle {
  return {
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.cluster,
  };
}

// INFO: a chip is the small secondary button (36 high, radius 18, surface and border, 13px
// semibold, accent border pressed, dimmed disabled) with 14 on the sides as the design draws.
export function quickAskChipStyle(state: { pressed?: boolean; disabled?: boolean }): {
  container: ViewStyle;
  label: TextStyle;
} {
  const { container, label } = buttonStyle("secondary", state, { small: true });
  return { container: { ...container, paddingHorizontal: spacing.card }, label };
}
