// apps/mobile/test/components/feedback-sheet-style.test.ts
//
// Tests for feedbackSheetStyle.
//
// Tested:
// - The sheet right (accent-deep) and miss (muted orange), as exercise-choose.html and exercise-not-quite.html draw them
// - The badge and the Continue button of each tone
//
// What is covered:
// - Normal case, edges
//
// Run with: pnpm exec jest apps/mobile/test/components/feedback-sheet-style.test.ts
//
// SEE: apps/mobile/src/components/feedback-sheet-style.ts

import { describe, expect, it } from "@jest/globals";

import { feedbackSheetStyle } from "@/components/feedback-sheet-style";
import { borderWidth, colors, radius, size, spacing } from "@/constants/theme";

describe("feedbackSheetStyle", () => {
  it("draws the right sheet on accent-deep with an accent-pressed top border", () => {
    expect(feedbackSheetStyle("right").sheet).toEqual({
      gap: spacing.group,
      paddingTop: spacing.hero,
      paddingHorizontal: spacing.screenSide,
      paddingBottom: spacing.composerBottom,
      borderTopLeftRadius: radius.sheet,
      borderTopRightRadius: radius.sheet,
      backgroundColor: colors.accentDeep,
      borderTopWidth: borderWidth.thin,
      borderTopColor: colors.accentPressed,
    });
  });

  it("draws the miss sheet on the muted orange surface with its line", () => {
    expect(feedbackSheetStyle("miss").sheet).toMatchObject({
      backgroundColor: colors.missSurface,
      borderTopColor: colors.missLine,
    });
  });

  it("draws the badge 28 round in the accent or the muted orange", () => {
    expect(feedbackSheetStyle("right").badge).toEqual({
      width: size.sheetBadge,
      height: size.sheetBadge,
      borderRadius: radius.pill,
      backgroundColor: colors.accent,
      alignItems: "center",
      justifyContent: "center",
    });
    expect(feedbackSheetStyle("miss").badge.backgroundColor).toBe(colors.miss);
  });

  it("uses the strong button when right and the miss button when missed", () => {
    expect(feedbackSheetStyle("right").button).toBe("strong");
    expect(feedbackSheetStyle("miss").button).toBe("miss");
  });

  it("delays the sheet by the tone's token", () => {
    expect(feedbackSheetStyle("right").iconName).toBe("check");
    expect(feedbackSheetStyle("miss").iconName).toBe("close");
  });
});
