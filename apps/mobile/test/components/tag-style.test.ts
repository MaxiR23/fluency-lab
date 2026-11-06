// apps/mobile/test/components/tag-style.test.ts
//
// Tests for tagStyle.
//
// Tested:
// - The box and label variant of the tint and the outline tag
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
});
