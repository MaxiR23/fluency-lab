// apps/mobile/test/utils/form-keyboard.test.ts
//
// Tests for formKeyboardOffset.
//
// Tested:
// - The gap the forms keep between the focused field and the keyboard
//
// What is covered:
// - Normal case, edges
//
// Run with: pnpm exec jest apps/mobile/test/utils/form-keyboard.test.ts
//
// SEE: apps/mobile/src/utils/form-keyboard.ts

import { describe, expect, it } from "@jest/globals";

import { lineHeight, size, spacing } from "@/constants/theme";
import { formKeyboardOffset } from "@/utils/form-keyboard";

describe("formKeyboardOffset", () => {
  it("leaves a field's lower edge the chat's keyboard gap above the keyboard", () => {
    const caretBottom = (size.control + lineHeight.body) / 2;
    expect(caretBottom + formKeyboardOffset - size.control).toBeCloseTo(spacing.composerKeyboard);
  });

  it("stays under one field height, so a focused field is never pushed past its top", () => {
    expect(formKeyboardOffset).toBeGreaterThan(0);
    expect(formKeyboardOffset).toBeLessThan(size.control);
  });
});
