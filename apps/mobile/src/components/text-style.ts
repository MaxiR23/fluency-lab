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
  | "tabActive"
  | "tabSelected"
  | "message"
  | "correction"
  | "struck"
  | "explanation"
  | "chatTitle"
  | "cardHeading"
  | "cardBody"
  | "tagOutline"
  | "screenTitle"
  | "intro"
  | "swipeAction"
  | "swipeActionDanger"
  | "captionLinkStrong"
  | "avatarLarge"
  | "profileName"
  | "stat"
  | "statSmall"
  | "bodyDanger"
  | "actionMuted"
  | "word"
  | "quote";

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
    fontFamily: fontFamily.semibold,
    fontSize: fontSize.micro,
    color: colors.textMuted,
  },
  tabActive: {
    fontFamily: fontFamily.semibold,
    fontSize: fontSize.xsmall,
    color: colors.accent,
  },
  tabSelected: {
    fontFamily: fontFamily.semibold,
    fontSize: fontSize.micro,
    color: colors.text,
  },
  message: {
    fontFamily: fontFamily.regular,
    fontSize: fontSize.body,
    color: colors.text,
    lineHeight: lineHeight.body,
  },
  correction: {
    fontFamily: fontFamily.regular,
    fontSize: fontSize.small,
    color: colors.text,
    lineHeight: lineHeight.small,
  },
  struck: {
    fontFamily: fontFamily.regular,
    fontSize: fontSize.small,
    color: colors.textMuted,
    textDecorationLine: "line-through",
  },
  explanation: {
    fontFamily: fontFamily.regular,
    fontSize: fontSize.caption,
    color: colors.textMuted,
    lineHeight: lineHeight.explanation,
  },
  chatTitle: {
    fontFamily: fontFamily.bold,
    fontSize: fontSize.chatTitle,
    color: colors.text,
  },
  cardHeading: {
    fontFamily: fontFamily.bold,
    fontSize: fontSize.cardHeading,
    color: colors.text,
    textAlign: "center",
  },
  cardBody: {
    fontFamily: fontFamily.regular,
    fontSize: fontSize.small,
    color: colors.textMuted,
    lineHeight: lineHeight.small,
    textAlign: "center",
  },
  tagOutline: {
    fontFamily: fontFamily.semibold,
    fontSize: fontSize.caption,
    color: colors.accent,
  },
  screenTitle: {
    fontFamily: fontFamily.bold,
    fontSize: fontSize.cardHeading,
    color: colors.text,
  },
  intro: {
    fontFamily: fontFamily.regular,
    fontSize: fontSize.small,
    color: colors.textMuted,
    lineHeight: lineHeight.small,
  },
  swipeAction: {
    fontFamily: fontFamily.semibold,
    fontSize: fontSize.xsmall,
    color: colors.text,
  },
  swipeActionDanger: {
    fontFamily: fontFamily.semibold,
    fontSize: fontSize.xsmall,
    color: colors.error,
  },
  captionLinkStrong: {
    fontFamily: fontFamily.semibold,
    fontSize: fontSize.caption,
    color: colors.accent,
  },
  avatarLarge: {
    fontFamily: fontFamily.bold,
    fontSize: fontSize.avatarLarge,
    color: colors.accent,
  },
  profileName: {
    fontFamily: fontFamily.bold,
    fontSize: fontSize.name,
    color: colors.text,
  },
  stat: {
    fontFamily: fontFamily.bold,
    fontSize: fontSize.stat,
    color: colors.text,
  },
  statSmall: {
    fontFamily: fontFamily.bold,
    fontSize: fontSize.name,
    color: colors.text,
  },
  bodyDanger: {
    fontFamily: fontFamily.regular,
    fontSize: fontSize.body,
    color: colors.error,
  },
  actionMuted: {
    fontFamily: fontFamily.semibold,
    fontSize: fontSize.small,
    color: colors.textMuted,
  },
  word: {
    fontFamily: fontFamily.bold,
    fontSize: fontSize.avatar,
    color: colors.accent,
  },
  quote: {
    fontFamily: fontFamily.regular,
    fontSize: fontSize.caption,
    color: colors.textMuted,
    lineHeight: lineHeight.quote,
  },
};

export function textStyle(variant: TextVariant = "body"): TextStyle {
  return variants[variant];
}
