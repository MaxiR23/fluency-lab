// apps/mobile/test/components/toggle-switch-style.test.ts
//
// Tests for toggleSwitchStyle.
//
// Tested:
// - The track and knob of the switch when on and when off
//
// What is covered:
// - Normal case, empty case, edges
//
// Run with: pnpm exec jest apps/mobile/test/components/toggle-switch-style.test.ts
//
// SEE: apps/mobile/src/components/toggle-switch-style.ts

import { describe, expect, it } from "@jest/globals";

import { toggleSwitchStyle } from "@/components/toggle-switch-style";
import { borderWidth, colors, radius, size, spacing } from "@/constants/theme";

describe("toggleSwitchStyle", () => {
  it("places the knob right on accentLine when on", () => {
    const { track, knob } = toggleSwitchStyle(true);
    expect(track).toMatchObject({
      width: size.switchWidth,
      height: size.switchHeight,
      borderRadius: radius.pill,
      backgroundColor: colors.accentLine,
      borderColor: colors.accentPressed,
      borderWidth: borderWidth.thin,
    });
    expect(knob).toMatchObject({
      position: "absolute",
      top: spacing.hair,
      right: spacing.hair,
      width: size.switchKnob,
      height: size.switchKnob,
      borderRadius: radius.pill,
      backgroundColor: colors.text,
    });
    expect(knob.left).toBeUndefined();
  });

  it("places the knob left on surfaceSunken when off", () => {
    const { track, knob } = toggleSwitchStyle(false);
    expect(track).toMatchObject({
      backgroundColor: colors.surfaceSunken,
      borderColor: colors.border,
    });
    expect(knob).toMatchObject({ left: spacing.hair, backgroundColor: colors.textMuted });
    expect(knob.right).toBeUndefined();
  });
});
