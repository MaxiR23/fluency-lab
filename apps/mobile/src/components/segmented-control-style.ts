import type { AccessibilityRole, ViewStyle } from "react-native";

import { selectableStyle } from "@/components/selectable-style";
import type { TextVariant } from "@/components/text-style";
import { borderWidth, colors, radius, size, spacing } from "@/constants/theme";

export type SegmentedLook = "choice" | "tabs";

export function segmentedStyle(look: SegmentedLook): {
  group: ViewStyle;
  segment: ViewStyle;
  selected: ViewStyle;
  label: (selected: boolean) => TextVariant;
  groupRole: AccessibilityRole;
  segmentRole: AccessibilityRole;
} {
  const tabs = look === "tabs";
  return {
    group: {
      flexDirection: "row",
      backgroundColor: colors.surface,
      borderColor: colors.border,
      borderWidth: borderWidth.thin,
      borderRadius: radius.control,
      padding: spacing.xs,
      gap: tabs ? spacing.stack : spacing.xs,
    },
    segment: {
      flex: 1,
      minHeight: tabs ? size.pill : size.control,
      // INFO: the same size border as the selected one, in the container color, so selecting does not shift the layout.
      borderWidth: borderWidth.thin,
      borderColor: colors.surface,
      borderRadius: tabs ? radius.note : radius.control,
      alignItems: "center",
      justifyContent: "center",
    },
    selected: tabs
      ? { backgroundColor: colors.accentLine, borderColor: colors.accentPressed }
      : selectableStyle({ selected: true }),
    label: (selected) => (tabs ? (selected ? "action" : "actionMuted") : "body"),
    groupRole: tabs ? "tablist" : "radiogroup",
    segmentRole: tabs ? "tab" : "radio",
  };
}
