import type { ViewStyle } from "react-native";

import { selectableStyle } from "@/components/selectable-style";
import { borderWidth, colors, radius, size, spacing } from "@/constants/theme";

export type ChipLook = "choice" | "topic";

// INFO: the choice look is the onboarding chip; the topic look is the 40 high pill of
// practice-focus.html, which shows its selection by color alone (no check).
export function chipStyle(
  look: ChipLook,
  { selected, pressed }: { selected: boolean; pressed: boolean },
): ViewStyle {
  if (look === "choice") {
    return {
      ...selectableStyle({ selected, pressed }),
      flexDirection: "row",
      alignItems: "center",
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
      gap: spacing.xs,
    };
  }
  const palette = selected
    ? { backgroundColor: colors.accentDeep, borderColor: colors.accentPressed }
    : {
        backgroundColor: colors.surface,
        borderColor: pressed ? colors.accentPressed : colors.border,
      };
  return {
    ...palette,
    borderWidth: borderWidth.thin,
    borderRadius: radius.pill,
    minHeight: size.pill,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: spacing.card,
    gap: spacing.xs,
  };
}
