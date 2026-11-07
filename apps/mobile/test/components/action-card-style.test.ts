// apps/mobile/test/components/action-card-style.test.ts
//
// Tests for actionCardStyle.
//
// Tested:
// - The card unselected, pressed and selected, as the focus rows of practice-focus.html
// - The radio circle and the icon box in each state
//
// What is covered:
// - Normal case, edges
//
// Run with: pnpm exec jest apps/mobile/test/components/action-card-style.test.ts
//
// SEE: apps/mobile/src/components/action-card-style.ts

import { describe, expect, it } from "@jest/globals";

import { actionCardStyle } from "@/components/action-card-style";
import { selectableStyle } from "@/components/selectable-style";
import { borderWidth, colors, radius, size } from "@/constants/theme";

describe("actionCardStyle", () => {
  it("draws the idle card as the selectable surface", () => {
    expect(actionCardStyle({ selected: false, pressed: false }).card).toEqual(
      selectableStyle({ selected: false, pressed: false }),
    );
  });

  it("draws the pressed card with an accent-pressed border", () => {
    expect(actionCardStyle({ selected: false, pressed: true }).card.borderColor).toBe(
      colors.accentPressed,
    );
  });

  it("draws the selected card on accent-deep with an accent-pressed border", () => {
    expect(actionCardStyle({ selected: true, pressed: false }).card).toEqual({
      ...selectableStyle({ selected: true }),
      borderColor: colors.accentPressed,
    });
  });

  it("draws the selected icon box on accent-tag and the idle one on accent-soft", () => {
    expect(actionCardStyle({ selected: true, pressed: false }).iconBox.backgroundColor).toBe(
      colors.accentTag,
    );
    expect(actionCardStyle({ selected: false, pressed: false }).iconBox.backgroundColor).toBe(
      colors.accentSoft,
    );
  });

  it("draws the empty radio as a border-strong ring", () => {
    expect(actionCardStyle({ selected: false, pressed: false }).radio).toEqual({
      width: size.radio,
      height: size.radio,
      borderRadius: radius.pill,
      borderWidth: borderWidth.thin,
      borderColor: colors.borderStrong,
      alignItems: "center",
      justifyContent: "center",
    });
  });

  it("draws the selected radio filled with accent-line and an accent-pressed border", () => {
    expect(actionCardStyle({ selected: true, pressed: false }).radio).toMatchObject({
      backgroundColor: colors.accentLine,
      borderColor: colors.accentPressed,
    });
  });
});
