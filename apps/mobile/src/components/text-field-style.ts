import type { TextStyle } from "react-native";

import { textStyle } from "@/components/text-style";
import {
  borderWidth,
  colors,
  fontFamily,
  fontSize,
  radius,
  size,
  spacing,
} from "@/constants/theme";

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
      minHeight: size.control,
      paddingVertical: 0,
      paddingHorizontal: spacing.md,
      color: colors.text,
      fontFamily: fontFamily.regular,
      fontSize: fontSize.body,
    },
    error: textStyle("error"),
  };
}
