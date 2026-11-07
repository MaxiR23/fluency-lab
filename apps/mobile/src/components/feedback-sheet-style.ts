import type { ViewStyle } from "react-native";

import type { ButtonVariant } from "@/components/button-style";
import type { IconName } from "@/components/icon";
import { borderWidth, colors, radius, size, spacing } from "@/constants/theme";

export type FeedbackTone = "right" | "miss";

// INFO: right is the accent-deep sheet of exercise-choose.html; miss is the muted orange one of
// exercise-not-quite.html. Continue is the strong button on the first and the miss button on the second.
export function feedbackSheetStyle(tone: FeedbackTone): {
  sheet: ViewStyle;
  badge: ViewStyle;
  button: ButtonVariant;
  iconName: IconName;
} {
  const right = tone === "right";
  return {
    sheet: {
      gap: spacing.group,
      paddingTop: spacing.hero,
      paddingHorizontal: spacing.screenSide,
      paddingBottom: spacing.composerBottom,
      borderTopLeftRadius: radius.sheet,
      borderTopRightRadius: radius.sheet,
      backgroundColor: right ? colors.accentDeep : colors.missSurface,
      borderTopWidth: borderWidth.thin,
      borderTopColor: right ? colors.accentPressed : colors.missLine,
    },
    badge: {
      width: size.sheetBadge,
      height: size.sheetBadge,
      borderRadius: radius.pill,
      backgroundColor: right ? colors.accent : colors.miss,
      alignItems: "center",
      justifyContent: "center",
    },
    button: right ? "strong" : "miss",
    iconName: right ? "check" : "close",
  };
}
