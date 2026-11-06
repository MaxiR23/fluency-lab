// apps/mobile/test/components/quick-ask-chips-style.test.ts
//
// Tests for the style functions of the quick-ask chips.
//
// Tested:
// - The row: 8 gap, 16 on the sides, 10 below
// - A chip is the small secondary button with 14 on the sides: 36 high, radius 18, surface and border
// - Pressed is the accent border; disabled is the secondary button's disabled look
//
// What is covered:
// - Normal case, edges
//
// Run with: pnpm exec jest apps/mobile/test/components/quick-ask-chips-style.test.ts
//
// SEE: apps/mobile/src/components/quick-ask-chips-style.ts

import { describe, expect, it } from "@jest/globals";

import { buttonStyle } from "@/components/button-style";
import { quickAskChipStyle, quickAskRowStyle } from "@/components/quick-ask-chips-style";
import { colors, radius, size, spacing } from "@/constants/theme";

describe("quickAskRowStyle", () => {
  it("has an 8 gap, 16 on the sides and 10 below", () => {
    expect(quickAskRowStyle()).toEqual({
      gap: spacing.sm,
      paddingHorizontal: spacing.md,
      paddingBottom: spacing.cluster,
    });
  });
});

describe("quickAskChipStyle", () => {
  it("is 36 high with radius 18, the surface and border, and 14 on the sides", () => {
    const { container, label } = quickAskChipStyle({});
    expect(container).toMatchObject({
      minHeight: size.controlSmall,
      borderRadius: radius.control,
      backgroundColor: colors.surface,
      borderColor: colors.border,
      paddingHorizontal: spacing.card,
    });
    expect(label).toEqual(buttonStyle("secondary", {}, { small: true }).label);
    expect([size.controlSmall, radius.control, spacing.card]).toEqual([36, 18, 14]);
  });

  it("takes the accent border while pressed", () => {
    expect(quickAskChipStyle({ pressed: true }).container.borderColor).toBe(colors.accentPressed);
  });

  it("takes the disabled look of the secondary button", () => {
    const { container, label } = quickAskChipStyle({ disabled: true });
    const disabled = buttonStyle("secondary", { disabled: true }, { small: true });
    expect(container.backgroundColor).toBe(disabled.container.backgroundColor);
    expect(container.borderColor).toBe(disabled.container.borderColor);
    expect(label.color).toBe(colors.textMuted);
  });
});
