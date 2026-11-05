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

import { colors, fontFamily, radius, spacing } from "@/constants/theme";

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

  it("names the two Plus Jakarta Sans faces the app loads", () => {
    expect(fontFamily).toEqual({
      regular: "PlusJakartaSans_400Regular",
      semibold: "PlusJakartaSans_600SemiBold",
    });
  });
});
