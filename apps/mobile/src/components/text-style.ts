import type { TextStyle } from "react-native";

import { colors, fontFamily, fontSize } from "@/constants/theme";

export type TextVariant = "title" | "body" | "muted" | "link";

const variants: Record<TextVariant, TextStyle> = {
  title: {
    fontFamily: fontFamily.semibold,
    fontSize: fontSize.title,
    color: colors.text,
  },
  body: {
    fontFamily: fontFamily.regular,
    fontSize: fontSize.body,
    color: colors.text,
  },
  muted: {
    fontFamily: fontFamily.regular,
    fontSize: fontSize.body,
    color: colors.textMuted,
  },
  link: {
    fontFamily: fontFamily.regular,
    fontSize: fontSize.body,
    color: colors.accent,
  },
};

export function textStyle(variant: TextVariant = "body"): TextStyle {
  return variants[variant];
}
