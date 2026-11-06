// apps/mobile/test/components/tag-style.test.ts
//
// Tests for tagStyle.
//
// Tested:
// - The box and label variant of the tint, the outline, the word and the count tag
//
// What is covered:
// - Normal case, edges
//
// Run with: pnpm exec jest apps/mobile/test/components/tag-style.test.ts
//
// SEE: apps/mobile/src/components/tag-style.ts

import { describe, expect, it } from "@jest/globals";

import { tagStyle } from "@/components/tag-style";
import { borderWidth, colors, radius, size, spacing } from "@/constants/theme";

describe("tagStyle", () => {
  it("keeps today's tint pill by default", () => {
    expect(tagStyle()).toEqual({
      box: {
        backgroundColor: colors.accentTag,
        borderRadius: radius.pill,
        paddingHorizontal: spacing.sm,
        paddingVertical: spacing.hair,
      },
      label: "tag",
    });
    expect(tagStyle("tint")).toEqual(tagStyle());
  });

  it("draws the outline pill on surface with a border, 28 high", () => {
    expect(tagStyle("outline")).toEqual({
      box: {
        backgroundColor: colors.surface,
        borderColor: colors.border,
        borderWidth: borderWidth.thin,
        borderRadius: radius.pill,
        minHeight: size.tag,
        paddingHorizontal: spacing.cluster,
        justifyContent: "center",
      },
      label: "tagOutline",
    });
  });

  it("draws the word chip on accent-soft with an accent-chip-line border, 34 high, a footer-link label", () => {
    expect(tagStyle("word")).toEqual({
      box: {
        backgroundColor: colors.accentSoft,
        borderColor: colors.accentChipLine,
        borderWidth: borderWidth.thin,
        borderRadius: radius.pill,
        minHeight: size.wordChip,
        paddingHorizontal: spacing.card,
        justifyContent: "center",
      },
      label: "footerLink",
    });
  });

  it("draws the count pill as the tint pill with a semibold 12 accent label", () => {
    expect(tagStyle("count")).toEqual({ box: tagStyle("tint").box, label: "tabActive" });
  });
});
