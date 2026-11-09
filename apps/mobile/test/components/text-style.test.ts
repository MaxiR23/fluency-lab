// apps/mobile/test/components/text-style.test.ts
//
// Tests for textStyle.
//
// Tested:
// - Each text variant maps to its family, size and color
// - The gap slot: the empty slot's explicit size and underline, the filled slot's underline
//
// What is covered:
// - Normal case, empty case, edges
//
// Run with: pnpm exec jest apps/mobile/test/components/text-style.test.ts
//
// SEE: apps/mobile/src/components/text-style.ts

import { describe, expect, it } from "@jest/globals";

import { gapSlotStyle, textStyle, type TextVariant } from "@/components/text-style";
import {
  borderWidth,
  colors,
  fontFamily,
  fontSize,
  letterSpacing,
  lineHeight,
  size,
} from "@/constants/theme";

describe("textStyle", () => {
  it("draws title in bold with its line height and letter spacing", () => {
    expect(textStyle("title")).toEqual({
      fontFamily: fontFamily.bold,
      fontSize: fontSize.title,
      color: colors.text,
      lineHeight: lineHeight.title,
      letterSpacing: letterSpacing.title,
    });
  });

  it("draws brand in bold with its letter spacing", () => {
    expect(textStyle("brand")).toEqual({
      fontFamily: fontFamily.bold,
      fontSize: fontSize.brand,
      color: colors.text,
      letterSpacing: letterSpacing.brand,
    });
  });

  it("draws subtitle muted with the body line height", () => {
    expect(textStyle("subtitle")).toEqual({
      fontFamily: fontFamily.regular,
      fontSize: fontSize.body,
      color: colors.textMuted,
      lineHeight: lineHeight.body,
    });
  });

  it("draws label in semibold at the caption size", () => {
    expect(textStyle("label")).toEqual({
      fontFamily: fontFamily.semibold,
      fontSize: fontSize.caption,
      color: colors.textMuted,
    });
  });

  it("draws caption muted at the caption size", () => {
    expect(textStyle("caption")).toEqual({
      fontFamily: fontFamily.regular,
      fontSize: fontSize.caption,
      color: colors.textMuted,
    });
  });

  it("draws captionLink in the accent color at the caption size", () => {
    expect(textStyle("captionLink")).toEqual({
      fontFamily: fontFamily.regular,
      fontSize: fontSize.caption,
      color: colors.accent,
    });
  });

  it("draws footer muted at the small size", () => {
    expect(textStyle("footer")).toEqual({
      fontFamily: fontFamily.regular,
      fontSize: fontSize.small,
      color: colors.textMuted,
    });
  });

  it("draws footerLink in semibold accent at the small size", () => {
    expect(textStyle("footerLink")).toEqual({
      fontFamily: fontFamily.semibold,
      fontSize: fontSize.small,
      color: colors.accent,
    });
  });

  it("draws error in the error color at the small size", () => {
    expect(textStyle("error")).toEqual({
      fontFamily: fontFamily.regular,
      fontSize: fontSize.small,
      color: colors.error,
    });
  });

  it("draws heading in bold with its line height and letter spacing", () => {
    expect(textStyle("heading")).toEqual({
      fontFamily: fontFamily.bold,
      fontSize: fontSize.heading,
      color: colors.text,
      lineHeight: lineHeight.heading,
      letterSpacing: letterSpacing.heading,
    });
  });

  it("draws heroTitle in bold with its letter spacing", () => {
    expect(textStyle("heroTitle")).toEqual({
      fontFamily: fontFamily.bold,
      fontSize: fontSize.hero,
      color: colors.text,
      letterSpacing: letterSpacing.hero,
    });
  });

  it("draws heroText muted with its line height", () => {
    expect(textStyle("heroText")).toEqual({
      fontFamily: fontFamily.regular,
      fontSize: fontSize.small,
      color: colors.textMuted,
      lineHeight: lineHeight.heroText,
    });
  });

  it("draws action in semibold text color at the small size", () => {
    expect(textStyle("action")).toEqual({
      fontFamily: fontFamily.semibold,
      fontSize: fontSize.small,
      color: colors.text,
    });
  });

  it("draws section in uppercase semibold with its letter spacing", () => {
    expect(textStyle("section")).toEqual({
      fontFamily: fontFamily.semibold,
      fontSize: fontSize.caption,
      color: colors.textMuted,
      letterSpacing: letterSpacing.section,
      textTransform: "uppercase",
    });
  });

  it("draws labelStrong in semibold text color at the caption size", () => {
    expect(textStyle("labelStrong")).toEqual({
      fontFamily: fontFamily.semibold,
      fontSize: fontSize.caption,
      color: colors.text,
    });
  });

  it("draws bodyStrong in semibold text color at the body size", () => {
    expect(textStyle("bodyStrong")).toEqual({
      fontFamily: fontFamily.semibold,
      fontSize: fontSize.body,
      color: colors.text,
    });
  });

  it("draws cardTitle in semibold with its line height", () => {
    expect(textStyle("cardTitle")).toEqual({
      fontFamily: fontFamily.semibold,
      fontSize: fontSize.body,
      color: colors.text,
      lineHeight: lineHeight.cardTitle,
    });
  });

  it("draws tag in semibold accent at the micro size", () => {
    expect(textStyle("tag")).toEqual({
      fontFamily: fontFamily.semibold,
      fontSize: fontSize.micro,
      color: colors.accent,
    });
  });

  it("draws day muted and dayToday bold in the text color, both at the micro size", () => {
    expect(textStyle("day")).toEqual({
      fontFamily: fontFamily.regular,
      fontSize: fontSize.micro,
      color: colors.textMuted,
    });
    expect(textStyle("dayToday")).toEqual({
      fontFamily: fontFamily.bold,
      fontSize: fontSize.micro,
      color: colors.text,
    });
  });

  it("draws why muted at the xsmall size", () => {
    expect(textStyle("why")).toEqual({
      fontFamily: fontFamily.regular,
      fontSize: fontSize.xsmall,
      color: colors.textMuted,
    });
  });

  it("draws avatar in bold accent at the avatar size", () => {
    expect(textStyle("avatar")).toEqual({
      fontFamily: fontFamily.bold,
      fontSize: fontSize.avatar,
      color: colors.accent,
    });
  });

  it("draws tab muted and tabSelected in the text color, both semibold at the micro size", () => {
    expect(textStyle("tab")).toEqual({
      fontFamily: fontFamily.semibold,
      fontSize: fontSize.micro,
      color: colors.textMuted,
    });
    expect(textStyle("tabSelected")).toEqual({
      fontFamily: fontFamily.semibold,
      fontSize: fontSize.micro,
      color: colors.text,
    });
  });

  it("keeps tabActive semibold accent at the xsmall size for the corrections label", () => {
    expect(textStyle("tabActive")).toEqual({
      fontFamily: fontFamily.semibold,
      fontSize: fontSize.xsmall,
      color: colors.accent,
    });
  });

  it("draws actionMuted as the action variant in the muted color", () => {
    expect(textStyle("actionMuted")).toEqual({
      fontFamily: fontFamily.semibold,
      fontSize: fontSize.small,
      color: colors.textMuted,
    });
  });

  it("draws word in bold accent at the avatar size", () => {
    expect(textStyle("word")).toEqual({
      fontFamily: fontFamily.bold,
      fontSize: fontSize.avatar,
      color: colors.accent,
    });
  });

  it("draws quote muted at the caption size with the quote line height", () => {
    expect(textStyle("quote")).toEqual({
      fontFamily: fontFamily.regular,
      fontSize: fontSize.caption,
      color: colors.textMuted,
      lineHeight: lineHeight.quote,
    });
  });

  it("draws message in regular body text with the body line height", () => {
    expect(textStyle("message")).toEqual({
      fontFamily: fontFamily.regular,
      fontSize: fontSize.body,
      color: colors.text,
      lineHeight: lineHeight.body,
    });
  });

  it("draws correction in regular small text with the small line height", () => {
    expect(textStyle("correction")).toEqual({
      fontFamily: fontFamily.regular,
      fontSize: fontSize.small,
      color: colors.text,
      lineHeight: lineHeight.small,
    });
  });

  it("draws struck muted with a line through", () => {
    expect(textStyle("struck")).toEqual({
      fontFamily: fontFamily.regular,
      fontSize: fontSize.small,
      color: colors.textMuted,
      textDecorationLine: "line-through",
    });
  });

  it("draws replyCount muted at the caption size in the medium face", () => {
    expect(textStyle("replyCount")).toEqual({
      fontFamily: fontFamily.medium,
      fontSize: fontSize.caption,
      color: colors.textMuted,
    });
  });

  it("draws withdrawn in the placeholder color with a line through and the small line height", () => {
    expect(textStyle("withdrawn")).toEqual({
      fontFamily: fontFamily.regular,
      fontSize: fontSize.small,
      color: colors.textPlaceholder,
      lineHeight: lineHeight.small,
      textDecorationLine: "line-through",
    });
  });

  it("draws explanation muted at the caption size with the explanation line height", () => {
    expect(textStyle("explanation")).toEqual({
      fontFamily: fontFamily.regular,
      fontSize: fontSize.caption,
      color: colors.textMuted,
      lineHeight: lineHeight.explanation,
    });
  });

  it("draws chatTitle in bold at the chat title size", () => {
    expect(textStyle("chatTitle")).toEqual({
      fontFamily: fontFamily.bold,
      fontSize: fontSize.chatTitle,
      color: colors.text,
    });
  });

  it("draws cardHeading in bold at the card heading size, centered", () => {
    expect(textStyle("cardHeading")).toEqual({
      fontFamily: fontFamily.bold,
      fontSize: fontSize.cardHeading,
      color: colors.text,
      textAlign: "center",
    });
  });

  it("draws cardBody muted, centered, with the small line height", () => {
    expect(textStyle("cardBody")).toEqual({
      fontFamily: fontFamily.regular,
      fontSize: fontSize.small,
      color: colors.textMuted,
      lineHeight: lineHeight.small,
      textAlign: "center",
    });
  });

  it("draws tagOutline in semibold accent at the caption size", () => {
    expect(textStyle("tagOutline")).toEqual({
      fontFamily: fontFamily.semibold,
      fontSize: fontSize.caption,
      color: colors.accent,
    });
  });

  it("uses a Plus Jakarta Sans face in every variant", () => {
    const variants: TextVariant[] = [
      "title",
      "brand",
      "subtitle",
      "label",
      "caption",
      "captionLink",
      "footer",
      "footerLink",
      "error",
      "body",
      "muted",
      "link",
      "heading",
      "heroTitle",
      "heroText",
      "action",
      "section",
      "labelStrong",
      "bodyStrong",
      "cardTitle",
      "tag",
      "day",
      "dayToday",
      "why",
      "avatar",
      "tab",
      "tabActive",
      "tabSelected",
      "message",
      "correction",
      "struck",
      "explanation",
      "chatTitle",
      "cardHeading",
      "cardBody",
      "tagOutline",
      "screenTitle",
      "intro",
      "swipeAction",
      "swipeActionDanger",
    ];
    for (const variant of variants) {
      expect(Object.values(fontFamily)).toContain(textStyle(variant).fontFamily);
    }
  });

  it("draws screenTitle in bold at the card heading size, not centered", () => {
    expect(textStyle("screenTitle")).toEqual({
      fontFamily: fontFamily.bold,
      fontSize: fontSize.cardHeading,
      color: colors.text,
    });
  });

  it("draws intro muted at the small size with the small line height", () => {
    expect(textStyle("intro")).toEqual({
      fontFamily: fontFamily.regular,
      fontSize: fontSize.small,
      color: colors.textMuted,
      lineHeight: lineHeight.small,
    });
  });

  it("draws swipeAction semibold at the xsmall size in the text color and swipeActionDanger in the error color", () => {
    expect(textStyle("swipeAction")).toEqual({
      fontFamily: fontFamily.semibold,
      fontSize: fontSize.xsmall,
      color: colors.text,
    });
    expect(textStyle("swipeActionDanger")).toEqual({
      fontFamily: fontFamily.semibold,
      fontSize: fontSize.xsmall,
      color: colors.error,
    });
  });

  it("draws muted in the muted color", () => {
    expect(textStyle("muted").color).toBe(colors.textMuted);
  });

  it("draws link in the accent color", () => {
    expect(textStyle("link").color).toBe(colors.accent);
  });

  it("falls back to body when no variant is given", () => {
    expect(textStyle()).toEqual({
      fontFamily: fontFamily.regular,
      fontSize: fontSize.body,
      color: colors.text,
    });
  });

  it("keeps body and muted at the same size and differs only in color", () => {
    expect({ ...textStyle("muted"), color: colors.text }).toEqual(textStyle("body"));
  });

  it("draws captionLinkStrong in semibold accent at the caption size", () => {
    expect(textStyle("captionLinkStrong")).toEqual({
      fontFamily: fontFamily.semibold,
      fontSize: fontSize.caption,
      color: colors.accent,
    });
  });

  it("draws avatarLarge, profileName and stat in bold at their own sizes", () => {
    expect(textStyle("avatarLarge")).toEqual({
      fontFamily: fontFamily.bold,
      fontSize: fontSize.avatarLarge,
      color: colors.accent,
    });
    expect(textStyle("profileName")).toEqual({
      fontFamily: fontFamily.bold,
      fontSize: fontSize.name,
      color: colors.text,
    });
    expect(textStyle("stat")).toEqual({
      fontFamily: fontFamily.bold,
      fontSize: fontSize.stat,
      color: colors.text,
    });
  });

  it("draws bodyDanger as the body in the error color", () => {
    expect(textStyle("bodyDanger")).toEqual({ ...textStyle("body"), color: colors.error });
  });

  it("draws the small stat value bold at 20 in text color", () => {
    expect(textStyle("statSmall")).toEqual({
      fontFamily: fontFamily.bold,
      fontSize: fontSize.name,
      color: colors.text,
    });
  });

  it("draws the practice variants from the practice tokens", () => {
    expect(textStyle("eyebrow")).toEqual({
      fontFamily: fontFamily.semibold,
      fontSize: fontSize.xsmall,
      color: colors.accent,
      letterSpacing: letterSpacing.eyebrow,
      textTransform: "uppercase",
    });
    expect(textStyle("ringCount")).toEqual({
      fontFamily: fontFamily.bold,
      fontSize: fontSize.body,
      color: colors.text,
    });
    expect(textStyle("tileText")).toEqual({
      fontFamily: fontFamily.regular,
      fontSize: fontSize.xsmall,
      color: colors.textMuted,
      lineHeight: lineHeight.tileText,
    });
    expect(textStyle("hint")).toEqual({
      fontFamily: fontFamily.regular,
      fontSize: fontSize.caption,
      color: colors.textMuted,
      lineHeight: lineHeight.hint,
    });
    expect(textStyle("actionStrong")).toEqual({
      fontFamily: fontFamily.bold,
      fontSize: fontSize.small,
      color: colors.text,
    });
    expect(textStyle("row")).toEqual({
      fontFamily: fontFamily.regular,
      fontSize: fontSize.small,
      color: colors.text,
    });
  });

  it("draws the prompt and its filled gap in the same type, the gap in accent and underlined", () => {
    const prompt = {
      fontFamily: fontFamily.semibold,
      fontSize: fontSize.prompt,
      color: colors.text,
      lineHeight: lineHeight.prompt,
      letterSpacing: letterSpacing.prompt,
    };
    expect(textStyle("prompt")).toEqual(prompt);
    expect(textStyle("promptSlot")).toEqual({
      ...prompt,
      color: colors.accent,
      textDecorationLine: "underline",
      textDecorationColor: colors.accent,
    });
  });

  it("draws the option, the source card, the sheet title, the score and the result title", () => {
    expect(textStyle("option")).toEqual({
      fontFamily: fontFamily.semibold,
      fontSize: fontSize.option,
      color: colors.text,
    });
    expect(textStyle("sourceLabel")).toEqual({
      fontFamily: fontFamily.semibold,
      fontSize: fontSize.xsmall,
      color: colors.textMuted,
    });
    expect(textStyle("source")).toEqual({
      fontFamily: fontFamily.semibold,
      fontSize: fontSize.cardHeading,
      color: colors.text,
      lineHeight: lineHeight.source,
    });
    expect(textStyle("sheetTitle")).toEqual({
      fontFamily: fontFamily.bold,
      fontSize: fontSize.sheetTitle,
      color: colors.text,
    });
    expect(textStyle("score")).toEqual({
      fontFamily: fontFamily.bold,
      fontSize: fontSize.score,
      color: colors.text,
      letterSpacing: letterSpacing.score,
    });
    expect(textStyle("resultTitle")).toEqual({
      fontFamily: fontFamily.bold,
      fontSize: fontSize.resultTitle,
      color: colors.text,
      letterSpacing: letterSpacing.resultTitle,
    });
  });

  it("draws noteLead bold in the accent at the caption size with the explanation line height", () => {
    expect(textStyle("noteLead")).toEqual({
      fontFamily: fontFamily.bold,
      fontSize: fontSize.caption,
      color: colors.accent,
      lineHeight: lineHeight.explanation,
    });
  });

  it("draws cell regular in the text color at the caption size with the explanation line height", () => {
    expect(textStyle("cell")).toEqual({
      fontFamily: fontFamily.regular,
      fontSize: fontSize.caption,
      color: colors.text,
      lineHeight: lineHeight.explanation,
    });
  });
});

describe("offlineTitle", () => {
  it("draws the offline title bold at 22 with -0.22 letter spacing, centered", () => {
    expect(textStyle("offlineTitle")).toEqual({
      fontFamily: fontFamily.bold,
      fontSize: fontSize.offlineTitle,
      color: colors.text,
      letterSpacing: letterSpacing.offlineTitle,
      textAlign: "center",
    });
  });
});

describe("gapSlotStyle", () => {
  it("draws the empty gap 120 wide with its 2 point accent underline", () => {
    expect(gapSlotStyle()).toEqual({
      width: size.gapSlot,
      height: borderWidth.slot,
      borderBottomWidth: borderWidth.slot,
      borderBottomColor: colors.accent,
    });
  });

  it("sizes the empty gap with an explicit width, never a min width a nested view loses", () => {
    expect(gapSlotStyle()).not.toHaveProperty("minWidth");
    expect(gapSlotStyle().width).toBe(120);
  });

  it("keeps the empty gap as tall as its underline so the prompt's line height does not move", () => {
    expect(gapSlotStyle().height).toBe(gapSlotStyle().borderBottomWidth);
    expect(gapSlotStyle().height).toBeLessThan(lineHeight.prompt);
  });
});
