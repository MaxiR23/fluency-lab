import type { TextStyle } from "react-native";

import { colors, fontFamily, fontSize, letterSpacing, lineHeight } from "@/constants/theme";

export type TextVariant =
  | "title"
  | "brand"
  | "subtitle"
  | "label"
  | "caption"
  | "captionLink"
  | "footer"
  | "footerLink"
  | "error"
  | "body"
  | "muted"
  | "link";

const variants: Record<TextVariant, TextStyle> = {
  title: {
    fontFamily: fontFamily.bold,
    fontSize: fontSize.title,
    color: colors.text,
    lineHeight: lineHeight.title,
    letterSpacing: letterSpacing.title,
  },
  brand: {
    fontFamily: fontFamily.bold,
    fontSize: fontSize.brand,
    color: colors.text,
    letterSpacing: letterSpacing.brand,
  },
  subtitle: {
    fontFamily: fontFamily.regular,
    fontSize: fontSize.body,
    color: colors.textMuted,
    lineHeight: lineHeight.body,
  },
  label: {
    fontFamily: fontFamily.semibold,
    fontSize: fontSize.caption,
    color: colors.textMuted,
  },
  caption: {
    fontFamily: fontFamily.regular,
    fontSize: fontSize.caption,
    color: colors.textMuted,
  },
  captionLink: {
    fontFamily: fontFamily.regular,
    fontSize: fontSize.caption,
    color: colors.accent,
  },
  footer: {
    fontFamily: fontFamily.regular,
    fontSize: fontSize.small,
    color: colors.textMuted,
  },
  footerLink: {
    fontFamily: fontFamily.semibold,
    fontSize: fontSize.small,
    color: colors.accent,
  },
  error: {
    fontFamily: fontFamily.regular,
    fontSize: fontSize.small,
    color: colors.error,
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
