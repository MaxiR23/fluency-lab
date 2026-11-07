// apps/mobile/test/components/answer-option-style.test.ts
//
// Tests for answerOptionStyle.
//
// Tested:
// - The option idle, right and wrong, as exercise-choose.html and exercise-not-quite.html draw them
// - The badge of the verdict
//
// What is covered:
// - Normal case, edges
//
// Run with: pnpm exec jest apps/mobile/test/components/answer-option-style.test.ts
//
// SEE: apps/mobile/src/components/answer-option-style.ts

import { describe, expect, it } from "@jest/globals";

import { answerOptionStyle } from "@/components/answer-option-style";
import { borderWidth, colors, radius, size, spacing } from "@/constants/theme";

describe("answerOptionStyle", () => {
  it("draws the idle option on surface, 56 high, with 18 of side padding", () => {
    expect(answerOptionStyle("idle").container).toEqual({
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      minHeight: size.option,
      paddingHorizontal: spacing.hero,
      borderRadius: radius.control,
      borderWidth: borderWidth.thin,
      backgroundColor: colors.surface,
      borderColor: colors.border,
    });
  });

  it("draws the right option on accent-deep with an accent border", () => {
    expect(answerOptionStyle("right").container).toMatchObject({
      backgroundColor: colors.accentDeep,
      borderColor: colors.accent,
    });
  });

  it("draws the wrong option on surface with a muted orange border", () => {
    expect(answerOptionStyle("wrong").container).toMatchObject({
      backgroundColor: colors.surface,
      borderColor: colors.miss,
    });
  });

  it("gives the animation the colors it moves from and to", () => {
    expect(answerOptionStyle("right").from).toEqual({
      backgroundColor: colors.surface,
      borderColor: colors.border,
    });
    expect(answerOptionStyle("right").to).toEqual({
      backgroundColor: colors.accentDeep,
      borderColor: colors.accent,
    });
    expect(answerOptionStyle("wrong").to.borderColor).toBe(colors.miss);
    expect(answerOptionStyle("idle").to).toEqual(answerOptionStyle("idle").from);
  });

  it("draws the verdict badge 26 round in the accent or the muted orange", () => {
    expect(answerOptionStyle("right").badge).toEqual({
      width: size.checkBadge,
      height: size.checkBadge,
      borderRadius: radius.pill,
      backgroundColor: colors.accent,
      alignItems: "center",
      justifyContent: "center",
    });
    expect(answerOptionStyle("wrong").badge.backgroundColor).toBe(colors.miss);
  });

  it("has no badge when idle", () => {
    expect(answerOptionStyle("idle").hasBadge).toBe(false);
    expect(answerOptionStyle("right").hasBadge).toBe(true);
    expect(answerOptionStyle("wrong").hasBadge).toBe(true);
  });
});
