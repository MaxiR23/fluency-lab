import type { ViewStyle } from "react-native";

import { borderWidth, colors, radius, size, spacing } from "@/constants/theme";

// INFO: the design draws only the on state. Off is decided here: a sunken track with the
// border color and a muted knob at the left.
export function toggleSwitchStyle(on: boolean): { track: ViewStyle; knob: ViewStyle } {
  return {
    track: {
      width: size.switchWidth,
      height: size.switchHeight,
      borderRadius: radius.pill,
      borderWidth: borderWidth.thin,
      backgroundColor: on ? colors.accentLine : colors.surfaceSunken,
      borderColor: on ? colors.accentPressed : colors.border,
    },
    knob: {
      position: "absolute",
      top: spacing.hair,
      ...(on ? { right: spacing.hair } : { left: spacing.hair }),
      width: size.switchKnob,
      height: size.switchKnob,
      borderRadius: radius.pill,
      backgroundColor: on ? colors.text : colors.textMuted,
    },
  };
}
