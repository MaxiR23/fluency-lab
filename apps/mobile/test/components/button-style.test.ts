// apps/mobile/test/components/button-style.test.ts
//
// Tests for buttonStyle.
//
// Tested:
// - Container and label colors per variant and state
// - The strong variant: accent-line fill, pill radius, control height
//
// What is covered:
// - Normal case, empty case, edges
//
// Run with: pnpm exec jest apps/mobile/test/components/button-style.test.ts
//
// SEE: apps/mobile/src/components/button-style.ts

import { describe, expect, it } from "@jest/globals";

import { buttonStyle } from "@/components/button-style";
import { colors, fontFamily, fontSize, radius, size, spacing } from "@/constants/theme";

describe("buttonStyle", () => {
  it("draws idle primary on accent with an accent-deep label", () => {
    const { container, label } = buttonStyle("primary");
    expect(container.backgroundColor).toBe(colors.accent);
    expect(container.borderColor).toBe(colors.accent);
    expect(label.color).toBe(colors.accentDeep);
  });

  it("draws pressed primary on accent-pressed with a text label", () => {
    const { container, label } = buttonStyle("primary", { pressed: true });
    expect(container.backgroundColor).toBe(colors.accentPressed);
    expect(container.borderColor).toBe(colors.accentPressed);
    expect(label.color).toBe(colors.text);
  });

  it("draws disabled primary on surface with a muted label", () => {
    const { container, label } = buttonStyle("primary", { disabled: true });
    expect(container.backgroundColor).toBe(colors.surface);
    expect(container.borderColor).toBe(colors.border);
    expect(label.color).toBe(colors.textMuted);
  });

  it("draws idle secondary on surface with a text label", () => {
    const { container, label } = buttonStyle("secondary");
    expect(container.backgroundColor).toBe(colors.surface);
    expect(container.borderColor).toBe(colors.border);
    expect(label.color).toBe(colors.text);
  });

  it("draws pressed secondary with an accent-pressed border", () => {
    const { container, label } = buttonStyle("secondary", { pressed: true });
    expect(container.backgroundColor).toBe(colors.surface);
    expect(container.borderColor).toBe(colors.accentPressed);
    expect(label.color).toBe(colors.text);
  });

  it("draws disabled secondary on background with a muted label", () => {
    const { container, label } = buttonStyle("secondary", { disabled: true });
    expect(container.backgroundColor).toBe(colors.background);
    expect(container.borderColor).toBe(colors.border);
    expect(label.color).toBe(colors.textMuted);
  });

  it("falls back to idle primary with no arguments", () => {
    expect(buttonStyle()).toEqual(buttonStyle("primary", {}));
    expect(buttonStyle().container.backgroundColor).toBe(colors.accent);
  });

  it("draws disabled over pressed on primary", () => {
    expect(buttonStyle("primary", { pressed: true, disabled: true })).toEqual(
      buttonStyle("primary", { disabled: true }),
    );
  });

  it("draws disabled over pressed on secondary", () => {
    expect(buttonStyle("secondary", { pressed: true, disabled: true })).toEqual(
      buttonStyle("secondary", { disabled: true }),
    );
  });

  it("treats pressed and disabled set to false as idle", () => {
    expect(buttonStyle("primary", { pressed: false, disabled: false })).toEqual(
      buttonStyle("primary"),
    );
  });

  it("uses the control radius in every variant and state", () => {
    for (const variant of ["primary", "secondary", "deep"] as const) {
      for (const state of [{}, { pressed: true }, { disabled: true }]) {
        expect(buttonStyle(variant, state).container.borderRadius).toBe(radius.control);
      }
    }
  });

  it("draws idle deep on accent-deep with an accent-line border and a text label", () => {
    const { container, label } = buttonStyle("deep");
    expect(container.backgroundColor).toBe(colors.accentDeep);
    expect(container.borderColor).toBe(colors.accentLine);
    expect(label.color).toBe(colors.text);
  });

  it("draws pressed deep like pressed primary", () => {
    expect(buttonStyle("deep", { pressed: true })).toEqual(
      buttonStyle("primary", { pressed: true }),
    );
  });

  it("draws disabled deep like disabled primary", () => {
    expect(buttonStyle("deep", { disabled: true })).toEqual(
      buttonStyle("primary", { disabled: true }),
    );
  });

  it("gives every variant the control min height", () => {
    for (const variant of ["primary", "secondary", "deep"] as const) {
      expect(buttonStyle(variant).container.minHeight).toBe(size.control);
    }
  });

  it("draws a compact button 48 high", () => {
    expect(buttonStyle("deep", {}, { compact: true }).container.minHeight).toBe(
      size.controlCompact,
    );
  });

  it("keeps the control height when not compact", () => {
    expect(buttonStyle("deep", {}, { compact: false }).container.minHeight).toBe(size.control);
  });

  it("draws a small secondary button as the design's Edit name button", () => {
    const { container, label } = buttonStyle("secondary", {}, { small: true });
    expect(container.minHeight).toBe(size.controlSmall);
    expect(size.controlSmall).toBe(36);
    expect(container.paddingHorizontal).toBe(spacing.md);
    expect(container.borderRadius).toBe(radius.control);
    expect(container.backgroundColor).toBe(colors.surface);
    expect(container.borderColor).toBe(colors.border);
    expect(label.color).toBe(colors.text);
    expect(label.fontFamily).toBe(fontFamily.semibold);
    expect(label.fontSize).toBe(fontSize.caption);
  });

  it("leaves the default and compact styles unchanged when small is not set", () => {
    expect(buttonStyle("secondary", {}, { small: false })).toEqual(buttonStyle("secondary"));
    expect(buttonStyle("secondary", {}, { compact: true }).label.fontSize).toBe(fontSize.body);
    expect(buttonStyle("secondary", {}, { compact: true }).container.paddingHorizontal).toBe(
      spacing.lg,
    );
  });

  it("draws idle strong on accent-line with an accent-pressed border, a text label and a pill radius", () => {
    const { container, label } = buttonStyle("strong");
    expect(container.backgroundColor).toBe(colors.accentLine);
    expect(container.borderColor).toBe(colors.accentPressed);
    expect(container.borderRadius).toBe(radius.pill);
    expect(label.color).toBe(colors.text);
  });

  it("draws pressed strong like pressed primary, with the pill radius", () => {
    const strong = buttonStyle("strong", { pressed: true });
    const primary = buttonStyle("primary", { pressed: true });
    expect(strong.container).toEqual({ ...primary.container, borderRadius: radius.pill });
    expect(strong.label).toEqual(primary.label);
  });

  it("draws disabled strong like disabled primary, with the pill radius", () => {
    const strong = buttonStyle("strong", { disabled: true });
    const primary = buttonStyle("primary", { disabled: true });
    expect(strong.container).toEqual({ ...primary.container, borderRadius: radius.pill });
    expect(strong.label).toEqual(primary.label);
  });

  it("gives strong the control min height", () => {
    expect(buttonStyle("strong").container.minHeight).toBe(size.control);
  });
});
