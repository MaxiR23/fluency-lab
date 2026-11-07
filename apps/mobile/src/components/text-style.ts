import type { TextStyle, ViewStyle } from "react-native";

import {
  borderWidth,
  colors,
  fontFamily,
  fontSize,
  letterSpacing,
  lineHeight,
  size,
} from "@/constants/theme";

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
  | "quote"
  | "replyCount"
  | "withdrawn"
  | "eyebrow"
  | "ringCount"
  | "tileText"
  | "hint"
  | "actionStrong"
  | "prompt"
  | "promptSlot"
  | "option"
  | "sourceLabel"
  | "source"
  | "sheetTitle"
  | "score"
  | "resultTitle"
  | "row"
  | "noteLead"
  | "cell";

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
  replyCount: {
    fontFamily: fontFamily.medium,
    fontSize: fontSize.caption,
    color: colors.textMuted,
  },
  withdrawn: {
    fontFamily: fontFamily.regular,
    fontSize: fontSize.small,
    color: colors.textPlaceholder,
    lineHeight: lineHeight.small,
    textDecorationLine: "line-through",
  },
  noteLead: {
    fontFamily: fontFamily.bold,
    fontSize: fontSize.caption,
    color: colors.accent,
    lineHeight: lineHeight.explanation,
  },
  cell: {
    fontFamily: fontFamily.regular,
    fontSize: fontSize.caption,
    color: colors.text,
    lineHeight: lineHeight.explanation,
  },
  eyebrow: {
    fontFamily: fontFamily.semibold,
    fontSize: fontSize.xsmall,
    color: colors.accent,
    letterSpacing: letterSpacing.eyebrow,
    textTransform: "uppercase",
  },
  ringCount: {
    fontFamily: fontFamily.bold,
    fontSize: fontSize.body,
    color: colors.text,
  },
  tileText: {
    fontFamily: fontFamily.regular,
    fontSize: fontSize.xsmall,
    color: colors.textMuted,
    lineHeight: lineHeight.tileText,
  },
  hint: {
    fontFamily: fontFamily.regular,
    fontSize: fontSize.caption,
    color: colors.textMuted,
    lineHeight: lineHeight.hint,
  },
  actionStrong: {
    fontFamily: fontFamily.bold,
    fontSize: fontSize.small,
    color: colors.text,
  },
  prompt: {
    fontFamily: fontFamily.semibold,
    fontSize: fontSize.prompt,
    color: colors.text,
    lineHeight: lineHeight.prompt,
    letterSpacing: letterSpacing.prompt,
  },
  promptSlot: {
    fontFamily: fontFamily.semibold,
    fontSize: fontSize.prompt,
    color: colors.accent,
    lineHeight: lineHeight.prompt,
    letterSpacing: letterSpacing.prompt,
    textDecorationLine: "underline",
    textDecorationColor: colors.accent,
  },
  option: {
    fontFamily: fontFamily.semibold,
    fontSize: fontSize.option,
    color: colors.text,
  },
  sourceLabel: {
    fontFamily: fontFamily.semibold,
    fontSize: fontSize.xsmall,
    color: colors.textMuted,
  },
  source: {
    fontFamily: fontFamily.semibold,
    fontSize: fontSize.cardHeading,
    color: colors.text,
    lineHeight: lineHeight.source,
  },
  sheetTitle: {
    fontFamily: fontFamily.bold,
    fontSize: fontSize.sheetTitle,
    color: colors.text,
  },
  score: {
    fontFamily: fontFamily.bold,
    fontSize: fontSize.score,
    color: colors.text,
    letterSpacing: letterSpacing.score,
  },
  resultTitle: {
    fontFamily: fontFamily.bold,
    fontSize: fontSize.resultTitle,
    color: colors.text,
    letterSpacing: letterSpacing.resultTitle,
  },
  row: {
    fontFamily: fontFamily.regular,
    fontSize: fontSize.small,
    color: colors.text,
  },
};

export function textStyle(variant: TextVariant = "body"): TextStyle {
  return variants[variant];
}

// INFO: the empty gap is a view nested in the prompt's Text, which React Native sizes only from an
// explicit width and height (a nested view's min size is dropped). Its bottom sits on the
// baseline, so it is only its 2 point underline, like the design's empty inline-block.
export function gapSlotStyle(): ViewStyle {
  return {
    width: size.gapSlot,
    height: borderWidth.slot,
    borderBottomWidth: borderWidth.slot,
    borderBottomColor: colors.accent,
  };
}
