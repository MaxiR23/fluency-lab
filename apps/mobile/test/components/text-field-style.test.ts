// apps/mobile/test/components/text-field-style.test.ts
//
// Tests for textFieldStyle.
//
// Tested:
// - The input border and the error message color follow the error state
//
// What is covered:
// - Normal case, edges
//
// Run with: pnpm exec jest apps/mobile/test/components/text-field-style.test.ts
//
// SEE: apps/mobile/src/components/text-field-style.ts

import { describe, expect, it } from "@jest/globals";

import { textStyle } from "@/components/text-style";
import { textFieldStyle } from "@/components/text-field-style";
import {
  borderWidth,
  colors,
  fontSize,
  lineHeight,
  radius,
  size,
  spacing,
} from "@/constants/theme";

describe("textFieldStyle", () => {
  it("uses the border color when there is no error", () => {
    expect(textFieldStyle({ hasError: false }).input.borderColor).toBe(colors.border);
  });

  it("uses the error color on the border and the message when there is an error", () => {
    const { input, error } = textFieldStyle({ hasError: true });
    expect(input.borderColor).toBe(colors.error);
    expect(error).toEqual(textStyle("error"));
  });

  it("keeps the control radius and thickness with and without an error", () => {
    for (const hasError of [false, true]) {
      const { input } = textFieldStyle({ hasError });
      expect(input.borderRadius).toBe(radius.control);
      expect(input.borderWidth).toBe(borderWidth.thin);
    }
  });

  it("gives the input the control min height and the side padding", () => {
    const { input } = textFieldStyle({ hasError: false });
    expect(input.minHeight).toBe(size.control);
    expect(input.paddingVertical).toBe(0);
    expect(input.paddingHorizontal).toBe(spacing.md);
  });

  it("keeps the form look when no look is given", () => {
    expect(textFieldStyle({ hasError: false })).toEqual(
      textFieldStyle({ hasError: false, look: "form", tone: "idle" }),
    );
  });

  it("draws the answer look of exercise-not-quite.html", () => {
    const { input } = textFieldStyle({ hasError: false, look: "answer", tone: "idle" });
    expect(input).toMatchObject({
      backgroundColor: colors.surfaceRaised,
      borderColor: colors.borderRaised,
      borderWidth: borderWidth.thin,
      borderRadius: radius.control,
      minHeight: size.option,
      paddingVertical: spacing.md,
      paddingHorizontal: spacing.screenSide,
      color: colors.text,
      fontSize: fontSize.option,
      lineHeight: lineHeight.answer,
    });
  });

  it("turns the answer border accent when right and miss when missed", () => {
    expect(
      textFieldStyle({ hasError: false, look: "answer", tone: "right" }).input.borderColor,
    ).toBe(colors.accent);
    expect(
      textFieldStyle({ hasError: false, look: "answer", tone: "miss" }).input.borderColor,
    ).toBe(colors.miss);
  });
});
