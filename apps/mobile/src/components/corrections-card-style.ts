import type { TextStyle, ViewStyle } from "react-native";

import { borderWidth, colors, radius, size, spacing } from "@/constants/theme";

// INFO: correction-thread-entry.html draws the card with 6 below when the ask row closes it,
// because the row is 44 high; without the row the chat's 12 stays.
export function correctionsCardStyle({ ask }: { ask: boolean }): ViewStyle {
  return {
    gap: spacing.stack,
    paddingTop: spacing.group,
    paddingBottom: ask ? spacing.stack : spacing.group,
    paddingHorizontal: spacing.card,
    borderRadius: radius.note,
    backgroundColor: colors.surfaceSunken,
    borderColor: colors.border,
    borderWidth: borderWidth.thin,
  };
}

export function askRowStyle(): ViewStyle {
  return { flexDirection: "row", alignItems: "center", gap: spacing.sm, minHeight: size.touch };
}

export function askLabelStyle(): TextStyle {
  return { flex: 1 };
}

export function askDividerStyle(): ViewStyle {
  return { marginTop: spacing.xs, gap: spacing.stack };
}

export function withdrawnRowStyle(): ViewStyle {
  return { flexDirection: "row", alignItems: "center", gap: spacing.sm };
}

export function withdrawnTextStyle(): TextStyle {
  return { flexShrink: 1 };
}
