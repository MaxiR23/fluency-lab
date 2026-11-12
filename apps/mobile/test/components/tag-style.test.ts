// apps/mobile/test/components/tag-style.test.ts
//
// Tests for tagStyle.
//
// Tested:
// - The box and label variant of the tint, the outline, the word, the count, the withdrawn and the type tag
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

  it("draws the type tag with 2 points of vertical padding", () => {
    expect(tagStyle("type")).toEqual({
      box: {
        backgroundColor: colors.accentTag,
        borderRadius: radius.pill,
        paddingHorizontal: spacing.sm,
        paddingVertical: spacing.tight,
        flexShrink: 0,
      },
      label: "tag",
    });
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

  it("draws the withdrawn badge on surface with a border, 22 high, 8 on the sides, a tab label", () => {
    expect(tagStyle("withdrawn")).toEqual({
      box: {
        backgroundColor: colors.surface,
        borderColor: colors.border,
        borderWidth: borderWidth.thin,
        borderRadius: radius.badgeSmall,
        minHeight: size.tagSmall,
        paddingHorizontal: spacing.sm,
        justifyContent: "center",
      },
      label: "tab",
    });
  });

  it("draws the count pill as the tint pill with a semibold 12 accent label", () => {
    expect(tagStyle("count")).toEqual({ box: tagStyle("tint").box, label: "tabActive" });
  });

  it("draws the rule tag on accent-tag as a pill, 4 by 10, with the active tab label", () => {
    expect(tagStyle("rule")).toEqual({
      box: {
        backgroundColor: colors.accentTag,
        borderRadius: radius.pill,
        paddingHorizontal: spacing.cluster,
        paddingVertical: spacing.xs,
        flexShrink: 1,
      },
      label: "tabActive",
      lines: 1,
    });
  });

  it("keeps the rule tag on one line that shrinks, and leaves every other variant unlimited", () => {
    expect(tagStyle("rule").lines).toBe(1);
    for (const variant of ["tint", "outline", "word", "count", "withdrawn", "type"] as const) {
      expect(tagStyle(variant).lines).toBeUndefined();
    }
  });
});
