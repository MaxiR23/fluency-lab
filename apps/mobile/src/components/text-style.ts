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
  | "link"
  | "heading"
  | "heroTitle"
  | "heroText"
  | "action"
  | "section"
  | "labelStrong"
  | "bodyStrong"
  | "cardTitle"
  | "tag"
  | "day"
  | "dayToday"
  | "why"
  | "avatar"
  | "tab"
  | "tabActive";

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
  heading: {
    fontFamily: fontFamily.bold,
    fontSize: fontSize.heading,
    color: colors.text,
    lineHeight: lineHeight.heading,
    letterSpacing: letterSpacing.heading,
  },
  heroTitle: {
    fontFamily: fontFamily.bold,
    fontSize: fontSize.hero,
    color: colors.text,
    letterSpacing: letterSpacing.hero,
  },
  heroText: {
    fontFamily: fontFamily.regular,
    fontSize: fontSize.small,
    color: colors.textMuted,
    lineHeight: lineHeight.heroText,
  },
  action: {
    fontFamily: fontFamily.semibold,
    fontSize: fontSize.small,
    color: colors.text,
  },
  section: {
    fontFamily: fontFamily.semibold,
    fontSize: fontSize.caption,
    color: colors.textMuted,
    letterSpacing: letterSpacing.section,
    textTransform: "uppercase",
  },
  labelStrong: {
    fontFamily: fontFamily.semibold,
    fontSize: fontSize.caption,
    color: colors.text,
  },
  bodyStrong: {
    fontFamily: fontFamily.semibold,
    fontSize: fontSize.body,
    color: colors.text,
  },
  cardTitle: {
    fontFamily: fontFamily.semibold,
    fontSize: fontSize.body,
    color: colors.text,
    lineHeight: lineHeight.cardTitle,
  },
  tag: {
    fontFamily: fontFamily.semibold,
    fontSize: fontSize.micro,
    color: colors.accent,
  },
  day: {
    fontFamily: fontFamily.regular,
    fontSize: fontSize.micro,
    color: colors.textMuted,
  },
  dayToday: {
    fontFamily: fontFamily.bold,
    fontSize: fontSize.micro,
    color: colors.text,
  },
  why: {
    fontFamily: fontFamily.regular,
    fontSize: fontSize.xsmall,
    color: colors.textMuted,
  },
  avatar: {
    fontFamily: fontFamily.bold,
    fontSize: fontSize.avatar,
    color: colors.accent,
  },
  tab: {
    fontFamily: fontFamily.regular,
    fontSize: fontSize.xsmall,
    color: colors.textMuted,
  },
  tabActive: {
    fontFamily: fontFamily.semibold,
    fontSize: fontSize.xsmall,
    color: colors.accent,
  },
};

export function textStyle(variant: TextVariant = "body"): TextStyle {
  return variants[variant];
}
