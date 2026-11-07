import type { ViewStyle } from "react-native";

import type { TextVariant } from "@/components/text-style";
import { borderWidth, colors, radius, spacing } from "@/constants/theme";

// INFO: the table of note.html. HTML sizes the columns by their content; React Native has no
// equivalent, so the columns share the width equally.
export function comparisonTableStyle(): {
  table: ViewStyle;
  headerRow: ViewStyle;
  headerCell: ViewStyle;
  row: (last: boolean) => ViewStyle;
  cell: ViewStyle;
} {
  return {
    table: {
      borderRadius: radius.badgeLarge,
      borderWidth: borderWidth.thin,
      borderColor: colors.border,
      overflow: "hidden",
    },
    headerRow: {
      flexDirection: "row",
      backgroundColor: colors.surface,
      borderBottomWidth: borderWidth.thin,
      borderBottomColor: colors.border,
    },
    headerCell: { flex: 1, paddingVertical: spacing.cluster, paddingHorizontal: spacing.group },
    row: (last) => ({
      flexDirection: "row",
      backgroundColor: colors.surfaceSunken,
      ...(last ? {} : { borderBottomWidth: borderWidth.thin, borderBottomColor: colors.border }),
    }),
    cell: { flex: 1, padding: spacing.group },
  };
}

// INFO: the first column is the lead (bold, accent), the second is muted, the third is plain. A row
// of one cell, a summary's point, is plain.
export function cellVariant(index: number, count: number): TextVariant {
  if (count < 3) return "cell";
  if (index === 0) return "noteLead";
  return index === 1 ? "explanation" : "cell";
}
