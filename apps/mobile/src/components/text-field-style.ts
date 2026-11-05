import type { TextStyle } from "react-native";

import { borderWidth, colors, fontFamily, fontSize, radius, spacing } from "@/constants/theme";

export function textFieldStyle({ hasError }: { hasError: boolean }): {
  input: TextStyle;
  error: TextStyle;
} {
  return {
    input: {
      backgroundColor: colors.surface,
      borderColor: hasError ? colors.error : colors.border,
      borderWidth: borderWidth.thin,
      borderRadius: radius.control,
      padding: spacing.md,
      color: colors.text,
      fontFamily: fontFamily.regular,
      fontSize: fontSize.body,
    },
    error: {
      color: colors.error,
      fontSize: fontSize.small,
    },
  };
}
