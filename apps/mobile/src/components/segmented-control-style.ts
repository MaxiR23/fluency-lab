import type { AccessibilityRole, ViewStyle } from "react-native";

import { selectableStyle } from "@/components/selectable-style";
import type { TextVariant } from "@/components/text-style";
import { borderWidth, colors, radius, size, spacing } from "@/constants/theme";

export type SegmentedLook = "choice" | "tabs" | "count";

export function segmentedStyle(look: SegmentedLook): {
  group: ViewStyle;
  segment: ViewStyle;
  selected: ViewStyle;
  label: (selected: boolean) => TextVariant;
  groupRole: AccessibilityRole;
  segmentRole: AccessibilityRole;
} {
  const tabs = look === "tabs";
  const count = look === "count";
  return {
    group: {
      flexDirection: "row",
      backgroundColor: colors.surface,
      borderColor: colors.border,
      borderWidth: borderWidth.thin,
      borderRadius: count ? radius.picker : radius.control,
      padding: spacing.xs,
      gap: count ? 0 : spacing.xs,
    },
    segment: {
      flex: 1,
      minHeight: tabs || count ? size.pill : size.control,
      // INFO: the same size border as the selected one, in the container color, so selecting does not shift the layout.
      borderWidth: borderWidth.thin,
      borderColor: colors.surface,
      borderRadius: tabs ? radius.note : radius.control,
      alignItems: "center",
      justifyContent: "center",
    },
    selected:
      tabs || count
        ? { backgroundColor: colors.accentLine, borderColor: colors.accentPressed }
        : selectableStyle({ selected: true }),
    label: (selected) => {
      if (count) return selected ? "actionStrong" : "actionMuted";
      // INFO: 13 point semibold labels, as progress-notes.html draws the four tabs.
      return tabs ? (selected ? "labelStrong" : "label") : "body";
    },
    groupRole: tabs ? "tablist" : "radiogroup",
    segmentRole: tabs ? "tab" : "radio",
  };
}
