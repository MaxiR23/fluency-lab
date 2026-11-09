import type { TextStyle } from "react-native";

import { textStyle } from "@/components/text-style";
import {
  borderWidth,
  colors,
  fontFamily,
  fontSize,
  lineHeight,
  radius,
  size,
  spacing,
} from "@/constants/theme";

export type TextFieldLook = "form" | "answer" | "sheet";
export type TextFieldTone = "idle" | "right" | "miss";

// INFO: the answer look is the typed answer of exercise-not-quite.html: raised surface, 56 high,
// and a border that turns accent when right and orange when missed.
export function textFieldStyle({
  hasError,
  look = "form",
  tone = "idle",
}: {
  hasError: boolean;
  look?: TextFieldLook;
  tone?: TextFieldTone;
}): {
  input: TextStyle;
  error: TextStyle;
} {
  // INFO: the rename sheet's title field (chat-rename.html): raised and accent, as it opens focused.
  if (look === "sheet") {
    return {
      input: {
        backgroundColor: colors.surfaceRaised,
        borderColor: colors.accent,
        borderWidth: borderWidth.thin,
        borderRadius: radius.control,
        minHeight: size.control,
        paddingVertical: 0,
        paddingHorizontal: spacing.hero,
        color: colors.text,
        fontFamily: fontFamily.regular,
        fontSize: fontSize.option,
      },
      error: textStyle("error"),
    };
  }
  if (look === "answer") {
    return {
      input: {
        backgroundColor: colors.surfaceRaised,
        borderColor:
          tone === "right" ? colors.accent : tone === "miss" ? colors.miss : colors.borderRaised,
        borderWidth: borderWidth.thin,
        borderRadius: radius.control,
        minHeight: size.option,
        paddingVertical: spacing.md,
        paddingHorizontal: spacing.screenSide,
        color: colors.text,
        fontFamily: fontFamily.regular,
        fontSize: fontSize.option,
        lineHeight: lineHeight.answer,
      },
      error: textStyle("error"),
    };
  }
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
