// apps/mobile/test/components/chip-style.test.ts
//
// Tests for chipStyle.
//
// Tested:
// - The choice look keeps the chip as the onboarding topics draw it
// - The topic look draws the grammar topic chips of practice-focus.html, idle and selected
//
// What is covered:
// - Normal case, edges
//
// Run with: pnpm exec jest apps/mobile/test/components/chip-style.test.ts
//
// SEE: apps/mobile/src/components/chip-style.ts

import { describe, expect, it } from "@jest/globals";

import { chipStyle } from "@/components/chip-style";
import { selectableStyle } from "@/components/selectable-style";
import { borderWidth, colors, radius, size, spacing } from "@/constants/theme";

describe("chipStyle", () => {
  it("keeps the choice look: the selectable surface with 16 by 8 padding", () => {
    expect(chipStyle("choice", { selected: false, pressed: false })).toEqual({
      ...selectableStyle({ selected: false, pressed: false }),
      flexDirection: "row",
      alignItems: "center",
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
      gap: spacing.xs,
    });
    expect(chipStyle("choice", { selected: true, pressed: false })).toMatchObject(
      selectableStyle({ selected: true }),
    );
  });

  it("draws the topic look as a 40 high pill with 14 of side padding", () => {
    expect(chipStyle("topic", { selected: false, pressed: false })).toEqual({
      backgroundColor: colors.surface,
      borderColor: colors.border,
      borderWidth: borderWidth.thin,
      borderRadius: radius.pill,
      minHeight: size.pill,
      flexDirection: "row",
      alignItems: "center",
      paddingHorizontal: spacing.card,
      gap: spacing.xs,
    });
  });

  it("draws the selected topic on accent-deep with an accent-pressed border", () => {
    expect(chipStyle("topic", { selected: true, pressed: false })).toMatchObject({
      backgroundColor: colors.accentDeep,
      borderColor: colors.accentPressed,
    });
  });

  it("draws the pressed topic with an accent-pressed border", () => {
    expect(chipStyle("topic", { selected: false, pressed: true }).borderColor).toBe(
      colors.accentPressed,
    );
  });
});
