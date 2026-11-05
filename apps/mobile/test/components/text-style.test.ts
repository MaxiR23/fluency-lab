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

import { textStyle } from "@/components/text-style";
import { colors, fontFamily, fontSize } from "@/constants/theme";

describe("textStyle", () => {
  it("draws title in semibold at the title size", () => {
    expect(textStyle("title")).toEqual({
      fontFamily: fontFamily.semibold,
      fontSize: fontSize.title,
      color: colors.text,
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
});
