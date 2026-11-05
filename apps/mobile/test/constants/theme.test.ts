// apps/mobile/test/constants/theme.test.ts
//
// Tests for the shared design tokens.
//
// Tested:
// - The README palette, accent-pressed and error
// - Radius, spacing scale and font faces
//
// What is covered:
// - Normal case, empty case, edges
//
// Run with: pnpm exec jest apps/mobile/test/constants/theme.test.ts
//
// SEE: apps/mobile/src/constants/theme.ts

import { describe, expect, it } from "@jest/globals";

import {
  colors,
  fontFamily,
  fontSize,
  letterSpacing,
  lineHeight,
  radius,
  size,
  spacing,
  strokeWidth,
} from "@/constants/theme";

describe("theme", () => {
  it("holds the eight README palette colors with their exact values", () => {
    expect({
      background: colors.background,
      surface: colors.surface,
      border: colors.border,
      text: colors.text,
      textMuted: colors.textMuted,
      accent: colors.accent,
      accentDeep: colors.accentDeep,
      accentLine: colors.accentLine,
    }).toEqual({
      background: "#000000",
      surface: "#141414",
      border: "#262626",
      text: "#F5F5F5",
      textMuted: "#A3A3A3",
      accent: "#6DA5C0",
      accentDeep: "#072E33",
      accentLine: "#0C4A50",
    });
  });

  it("holds accent-pressed as #0C7075", () => {
    expect(colors.accentPressed).toBe("#0C7075");
  });

  it("holds the error color as #F87171", () => {
    expect(colors.error).toBe("#F87171");
  });

  it("gives controls a radius of 18", () => {
    expect(radius.control).toBe(18);
  });

  it("orders the spacing scale from smallest to largest", () => {
    const values = [spacing.xs, spacing.sm, spacing.md, spacing.lg, spacing.xl];
    expect(values).toEqual([...values].sort((a, b) => a - b));
    expect(new Set(values).size).toBe(values.length);
  });

  it("holds the placeholder color as #737373", () => {
    expect(colors.textPlaceholder).toBe("#737373");
  });

  it("holds the badge radius beside the control radius", () => {
    expect(radius).toEqual({ control: 18, badge: 12 });
  });

  it("holds the design's control, badge and icon sizes", () => {
    expect(size).toEqual({ control: 52, badge: 40, icon: 22 });
    expect(strokeWidth.icon).toBe(1.8);
  });

  it("holds the design's font sizes", () => {
    expect(fontSize).toEqual({ caption: 13, small: 14, body: 15, brand: 17, title: 28 });
  });

  it("holds the design's line heights and letter spacings in pixels", () => {
    expect(lineHeight).toEqual({ body: 22.5, title: 33.6 });
    expect(letterSpacing).toEqual({ brand: -0.17, title: -0.56 });
  });

  it("holds the layout spacings the design names by role", () => {
    expect({
      linkVertical: spacing.linkVertical,
      logoGap: spacing.logoGap,
      group: spacing.group,
      screenSide: spacing.screenSide,
      screenBottom: spacing.screenBottom,
      screenTop: spacing.screenTop,
    }).toEqual({
      linkVertical: 6,
      logoGap: 10,
      group: 12,
      screenSide: 20,
      screenBottom: 40,
      screenTop: 72,
    });
  });

  it("names the three Plus Jakarta Sans faces the app loads", () => {
    expect(fontFamily).toEqual({
      regular: "PlusJakartaSans_400Regular",
      semibold: "PlusJakartaSans_600SemiBold",
      bold: "PlusJakartaSans_700Bold",
    });
  });
});
