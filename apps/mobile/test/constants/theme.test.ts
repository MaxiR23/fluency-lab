// apps/mobile/test/constants/theme.test.ts
//
// Tests for the shared design tokens.
//
// Tested:
// - The README palette, accent-pressed and error
// - Radius, spacing scale, sizes, tints, the raised shadow and font faces
// - The floating tab bar tokens and the tab pill spring
// - The Settings and Profile tokens: the spend bar, the switch, the large avatar and its glow
// - The Summary tokens: the done badge, its check and glow, and the word chip
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
  motion,
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
      dayCircle: 30,
      badgeSmall: 36,
      pill: 40,
      avatar: 44,
      touch: 44,
      swipeAction: 66,
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
      typingDot: 7,
      messageMaxWidth: "82%",
      listRow: 50,
      spendBar: 6,
      spendBarMin: 8,
      avatarLarge: 84,
      switchWidth: 46,
      switchHeight: 28,
      switchKnob: 20,
      doneBadge: 64,
      iconDone: 30,
      wordChip: 34,
    });
    expect(strokeWidth).toEqual({ icon: 1.8, action: 2, check: 2.4, send: 1.9, done: 2.2 });
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
      avatarLarge: 32,
      name: 20,
      stat: 22,
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
      tabBarBottom: 30,
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
      composerKeyboard: spacing.composerKeyboard,
      typingDot: spacing.typingDot,
      panel: spacing.panel,
    }).toEqual({
      tight: 2,
      composerBottom: 36,
      composerKeyboard: 18,
      typingDot: 5,
      panel: 28,
    });
  });

  it("holds the typing dot size of the design", () => {
    expect(size.typingDot).toBe(7);
  });

  it("holds the motion: the chat's enter, fade, press and dot loop, and the tab pill spring", () => {
    expect(motion).toEqual({
      enterDuration: 240,
      enterOffset: 12,
      fadeDuration: 200,
      pressDuration: 200,
      pressScale: 0.9,
      dotCycle: 1200,
      dotStagger: 150,
      dotPeakAt: 0.3,
      dotSettleAt: 0.6,
      dotLift: 4,
      dotRestOpacity: 0.3,
      pillDuration: 280,
      pillDampingRatio: 1,
      easeOut: [0, 0, 0.58, 1],
      easeInOut: [0.42, 0, 0.58, 1],
    });
  });

  it("keeps the dot keyframes inside one cycle", () => {
    expect(motion.dotPeakAt).toBeGreaterThan(0);
    expect(motion.dotPeakAt).toBeLessThan(motion.dotSettleAt);
    expect(motion.dotSettleAt).toBeLessThan(1);
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

  it("holds the floating tab bar tokens: side inset, translucent surface, shadow and pill glow", () => {
    expect(spacing.tabBarSide).toBe(40);
    expect(colors.surfaceFloating).toBe("rgba(20,20,20,0.94)");
    expect(colors.accentGlow).toBe("rgba(109,165,192,0.22)");
    expect(shadow.tabBar).toEqual({
      shadowColor: colors.shadow,
      shadowOffset: { width: 0, height: 12 },
      shadowOpacity: 0.8,
      shadowRadius: 14,
      elevation: 14,
    });
    expect(shadow.pillGlow).toEqual({
      shadowColor: colors.accentGlow,
      shadowOffset: { width: 0, height: 0 },
      shadowOpacity: 1,
      shadowRadius: 7,
    });
  });

  it("holds the swipe action width and the error tints", () => {
    expect(size.swipeAction).toBe(66);
    expect(colors.errorSoft).toBe("rgba(248,113,113,0.16)");
    expect(colors.errorLine).toBe("rgba(248,113,113,0.45)");
  });

  it("holds the settings and profile tokens with the design's values", () => {
    expect(colors.progressTrack).toBe("rgba(255,255,255,0.08)");
    expect(colors.accentHalo).toBe("rgba(109,165,192,0.15)");
    expect(spacing.pageGap).toBe(20);
    expect(spacing.screenTopHeader).toBe(52);
    expect(size.listRow).toBe(50);
    expect(size.spendBar).toBe(6);
    expect(size.spendBarMin).toBe(8);
    expect(size.avatarLarge).toBe(84);
    expect([size.switchWidth, size.switchHeight, size.switchKnob]).toEqual([46, 28, 20]);
    expect([fontSize.avatarLarge, fontSize.name, fontSize.stat]).toEqual([32, 20, 22]);
  });

  it("holds the avatar glow as a radius 12 shadow of accentHalo", () => {
    expect(shadow.avatarGlow).toEqual({
      shadowColor: colors.accentHalo,
      shadowOffset: { width: 0, height: 0 },
      shadowOpacity: 1,
      shadowRadius: 12,
    });
  });

  it("holds the Summary tokens: the done badge, its check and glow, and the word chip", () => {
    expect(size.doneBadge).toBe(64);
    expect(size.iconDone).toBe(30);
    expect(size.wordChip).toBe(34);
    expect(strokeWidth.done).toBe(2.2);
    expect(colors.accentRing).toBe("rgba(109,165,192,0.25)");
    expect(colors.accentChipLine).toBe("rgba(109,165,192,0.3)");
    expect(shadow.doneGlow).toEqual({
      shadowColor: colors.accentRing,
      shadowOffset: { width: 0, height: 0 },
      shadowOpacity: 1,
      shadowRadius: 12,
    });
  });
});
