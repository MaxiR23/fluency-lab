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
    ];
    for (const variant of variants) {
      expect(Object.values(fontFamily)).toContain(textStyle(variant).fontFamily);
    }
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
});
