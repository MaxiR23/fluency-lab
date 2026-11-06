// apps/mobile/test/constants/theme.test.ts
//
// Tests for the shared design tokens.
//
// Tested:
// - The README palette, accent-pressed and error
// - Radius, spacing scale, sizes, tints, the raised shadow and font faces
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
  shadow,
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
    expect(radius).toEqual({
      control: 18,
      badge: 12,
      hero: 22,
      pill: 999,
      badgeSmall: 11,
      bubble: 12,
      bubbleTail: 4,
      message: 18,
      messageTail: 6,
      note: 14,
      badgeLarge: 16,
    });
  });

  it("holds the design's control, badge, icon and progress bar sizes", () => {
    expect(size).toEqual({
      control: 52,
      badge: 40,
      icon: 22,
      progressBar: 4,
      iconCheck: 14,
      iconAction: 16,
      iconCard: 18,
      iconBadge: 20,
      iconTab: 24,
      dayCircle: 30,
      badgeSmall: 36,
      pill: 40,
      avatar: 44,
      touch: 44,
      tabItem: 64,
      suggestionCard: 200,
      heroArtWidth: 56,
      heroArtHeight: 48,
      bubbleLargeWidth: 38,
      bubbleLargeHeight: 28,
      bubbleSmallWidth: 34,
      bubbleSmallHeight: 24,
      controlCompact: 48,
      controlSmall: 36,
      badgeLarge: 52,
      iconBadgeLarge: 24,
      tag: 28,
      messageMaxWidth: "82%",
    });
    expect(strokeWidth).toEqual({ icon: 1.8, action: 2, check: 2.4, send: 1.9 });
  });

  it("holds the design's font sizes", () => {
    expect(fontSize).toEqual({
      micro: 11,
      xsmall: 12,
      caption: 13,
      small: 14,
      body: 15,
      avatar: 16,
      brand: 17,
      hero: 19,
      heading: 26,
      title: 28,
      chatTitle: 16,
      cardHeading: 18,
    });
  });

  it("holds the design's line heights and letter spacings in pixels", () => {
    expect(lineHeight).toEqual({
      body: 22.5,
      title: 33.6,
      heading: 31.2,
      heroText: 20.3,
      cardTitle: 19.5,
      small: 21,
      explanation: 18.2,
    });
    expect(letterSpacing).toEqual({
      brand: -0.17,
      title: -0.56,
      heading: -0.52,
      hero: -0.19,
      section: 1.04,
    });
  });

  it("holds the layout spacings the design names by role", () => {
    expect({
      linkVertical: spacing.linkVertical,
      logoGap: spacing.logoGap,
      group: spacing.group,
      screenSide: spacing.screenSide,
      screenBottom: spacing.screenBottom,
      screenTop: spacing.screenTop,
      hair: spacing.hair,
      stack: spacing.stack,
      cluster: spacing.cluster,
      card: spacing.card,
      hero: spacing.hero,
      section: spacing.section,
      tabBarBottom: spacing.tabBarBottom,
      screenTopShort: spacing.screenTopShort,
    }).toEqual({
      linkVertical: 6,
      logoGap: 10,
      group: 12,
      screenSide: 20,
      screenBottom: 40,
      screenTop: 72,
      hair: 3,
      stack: 6,
      cluster: 10,
      card: 14,
      hero: 18,
      section: 22,
      tabBarBottom: 28,
      screenTopShort: 56,
    });
  });

  it("holds the Home tints and the sunken surface", () => {
    expect({
      surfaceSunken: colors.surfaceSunken,
      accentSoft: colors.accentSoft,
      accentTag: colors.accentTag,
      accentBubble: colors.accentBubble,
      accentBubbleLine: colors.accentBubbleLine,
    }).toEqual({
      surfaceSunken: "#0A0A0A",
      accentSoft: "rgba(109,165,192,0.12)",
      accentTag: "rgba(109,165,192,0.16)",
      accentBubble: "rgba(109,165,192,0.18)",
      accentBubbleLine: "rgba(109,165,192,0.35)",
    });
  });

  it("holds the strong border for future days", () => {
    expect(colors.borderStrong).toBe("#404040");
  });

  it("holds one raised shadow with iOS shadow props and Android elevation", () => {
    expect(colors.shadow).toBe("#000000");
    expect(shadow.raised).toEqual({
      shadowColor: colors.shadow,
      shadowOffset: { width: 0, height: 10 },
      shadowOpacity: 0.6,
      shadowRadius: 12,
      elevation: 12,
    });
  });

  it("holds the chat input colors: raised and disabled", () => {
    expect({
      surfaceRaised: colors.surfaceRaised,
      borderRaised: colors.borderRaised,
      surfaceDisabled: colors.surfaceDisabled,
      borderDisabled: colors.borderDisabled,
      textDisabled: colors.textDisabled,
    }).toEqual({
      surfaceRaised: "#1A1A1A",
      borderRaised: "#2E2E2E",
      surfaceDisabled: "#0F0F0F",
      borderDisabled: "#1F1F1F",
      textDisabled: "#525252",
    });
  });

  it("holds the chat spacings by role", () => {
    expect({
      tight: spacing.tight,
      composerBottom: spacing.composerBottom,
      panel: spacing.panel,
    }).toEqual({ tight: 2, composerBottom: 36, panel: 28 });
  });

  it("holds the floating shadow and the accent glow", () => {
    expect(shadow.floating).toEqual({
      shadowColor: colors.shadow,
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.7,
      shadowRadius: 10,
      elevation: 10,
    });
    expect(shadow.glow).toEqual({
      shadowColor: colors.accentBubble,
      shadowOffset: { width: 0, height: 0 },
      shadowOpacity: 1,
      shadowRadius: 8,
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
