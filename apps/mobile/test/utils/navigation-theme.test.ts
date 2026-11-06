// apps/mobile/test/utils/navigation-theme.test.ts
//
// Tests for darkNavigationTheme.
//
// Tested:
// - Every navigation color comes from the shared tokens
// - The theme is dark and keeps the base fonts
//
// What is covered:
// - Normal case, empty case, edges
//
// Run with: pnpm exec jest apps/mobile/test/utils/navigation-theme.test.ts
//
// SEE: apps/mobile/src/utils/navigation-theme.ts

import { describe, expect, it } from "@jest/globals";
import { DarkTheme, DefaultTheme, type Theme } from "expo-router";

import { colors } from "@/constants/theme";
import { darkNavigationTheme } from "@/utils/navigation-theme";

const tokenColors = {
  background: colors.background,
  card: colors.surface,
  text: colors.text,
  border: colors.border,
  primary: colors.accent,
  notification: colors.error,
};

describe("darkNavigationTheme", () => {
  it("takes every navigation color from the shared tokens", () => {
    expect(darkNavigationTheme(DarkTheme).colors).toEqual(tokenColors);
  });

  it("leaves no navigation color outside the shared tokens", () => {
    const result = darkNavigationTheme(DarkTheme);
    const tokens: string[] = Object.values(colors);
    for (const value of Object.values(result.colors)) {
      expect(tokens).toContain(value);
    }
    expect(Object.keys(result.colors).sort()).toEqual(Object.keys(DarkTheme.colors).sort());
  });

  it("gives the screen background the background token, black", () => {
    const { background } = darkNavigationTheme(DarkTheme).colors;
    expect(background).toBe(colors.background);
    expect(background).toBe("#000000");
  });

  it("keeps the base theme's fonts", () => {
    expect(darkNavigationTheme(DarkTheme).fonts).toBe(DarkTheme.fonts);
  });

  it("is dark and uses the tokens even from the light default theme", () => {
    const result = darkNavigationTheme(DefaultTheme);
    expect(result.dark).toBe(true);
    expect(result.colors).toEqual(darkNavigationTheme(DarkTheme).colors);
  });

  it("fills every color from the tokens when the base theme has empty colors", () => {
    const empty: Theme = {
      ...DarkTheme,
      colors: { primary: "", background: "", card: "", text: "", border: "", notification: "" },
    };
    expect(darkNavigationTheme(empty).colors).toEqual(tokenColors);
  });
});
