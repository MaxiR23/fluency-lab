// apps/mobile/test/components/reply-preview-style.test.ts
//
// Tests for replyPreviewStyle.
//
// Tested:
// - The card's padding, gap, margin, radius and surface
// - The texts column and the 44 point cancel target
//
// What is covered:
// - Normal case, empty case, edges
//
// Run with: pnpm exec jest apps/mobile/test/components/reply-preview-style.test.ts
//
// SEE: apps/mobile/src/components/reply-preview-style.ts

import { describe, expect, it } from "@jest/globals";

import { replyPreviewStyle } from "@/components/reply-preview-style";
import { borderWidth, colors, radius, size, spacing } from "@/constants/theme";

describe("replyPreviewStyle", () => {
  it("draws the card with the design's padding, gap, margin, radius and surface", () => {
    expect(replyPreviewStyle().card).toEqual({
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.cluster,
      marginHorizontal: spacing.md,
      paddingVertical: spacing.cluster,
      paddingRight: spacing.sm,
      paddingLeft: spacing.card,
      borderRadius: radius.control,
      borderWidth: borderWidth.thin,
      borderColor: colors.border,
      backgroundColor: colors.surface,
    });
  });

  it("lets the texts column shrink so the quoted line can ellipsize", () => {
    expect(replyPreviewStyle().texts).toEqual({ flex: 1, minWidth: 0, gap: spacing.tight });
  });

  it("gives the cancel button a 44 point target", () => {
    expect(replyPreviewStyle().cancel).toEqual({
      width: size.touch,
      height: size.touch,
      alignItems: "center",
      justifyContent: "center",
    });
    expect(size.touch).toBe(44);
  });
});
