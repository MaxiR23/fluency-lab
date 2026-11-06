// apps/mobile/test/components/text-style.test.ts
//
// Tests for textStyle.
//
// Tested:
// - Each text variant maps to its family, size and color
//
// What is covered:
// - Normal case, empty case, edges
//
// Run with: pnpm exec jest apps/mobile/test/components/text-style.test.ts
//
// SEE: apps/mobile/src/components/text-style.ts

import { describe, expect, it } from "@jest/globals";

import { textStyle, type TextVariant } from "@/components/text-style";
import { colors, fontFamily, fontSize, letterSpacing, lineHeight } from "@/constants/theme";

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
});
