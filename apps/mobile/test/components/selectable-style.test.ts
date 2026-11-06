// apps/mobile/test/components/selectable-style.test.ts
//
// Tests for selectableStyle.
//
// Tested:
// - The selected, unselected and pressed look of an option
//
// What is covered:
// - Normal case, edges
//
// Run with: pnpm exec jest apps/mobile/test/components/selectable-style.test.ts
//
// SEE: apps/mobile/src/components/selectable-style.ts

import { describe, expect, it } from "@jest/globals";

import { selectableStyle } from "@/components/selectable-style";
import { borderWidth, colors, radius } from "@/constants/theme";

describe("selectableStyle", () => {
  it("draws selected on accent-deep with the accent-line border", () => {
    const style = selectableStyle({ selected: true });
    expect(style.backgroundColor).toBe(colors.accentDeep);
    expect(style.borderColor).toBe(colors.accentLine);
  });

  it("draws unselected on surface with the border color", () => {
    const style = selectableStyle({ selected: false });
    expect(style.backgroundColor).toBe(colors.surface);
    expect(style.borderColor).toBe(colors.border);
  });

  it("draws a pressed unselected option with the accent-pressed border", () => {
    const style = selectableStyle({ selected: false, pressed: true });
    expect(style.backgroundColor).toBe(colors.surface);
    expect(style.borderColor).toBe(colors.accentPressed);
  });

  it("keeps the selected look while pressed", () => {
    expect(selectableStyle({ selected: true, pressed: true })).toEqual(
      selectableStyle({ selected: true }),
    );
  });

  it("uses the thin border and the control radius in both states", () => {
    for (const selected of [true, false]) {
      const style = selectableStyle({ selected });
      expect(style.borderWidth).toBe(borderWidth.thin);
      expect(style.borderRadius).toBe(radius.control);
    }
  });
});
