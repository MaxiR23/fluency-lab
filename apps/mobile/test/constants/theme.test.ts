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
// - The reply tokens of chat-reply.html and chat-reply-sent.html
// - The medium face and the withdrawn badge height of the correction thread
// - The perfect day tokens of home-perfect-day.html: the flame colors, gradients, size, glow and flick
// - The title and rename tokens of chat-title.html and chat-rename.html: the scrim, the grabber and the swap and sheet timings
// - The practice tokens of the five design files: the muted orange, the rings, the prompt type and the motion timings
//
// What is covered:
// - Normal case, empty case, edges
//
// Run with: pnpm exec jest apps/mobile/test/constants/theme.test.ts
//
// SEE: apps/mobile/src/constants/theme.ts

import { describe, expect, it } from "@jest/globals";

import {
  borderWidth,
  colors,
  fontFamily,
  fontSize,
  gradient,
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
    expect(radius).toMatchObject({
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
    expect(size).toMatchObject({
      control: 52,
      badge: 40,
      icon: 22,
      progressBar: 4,
      iconCheck: 14,
      iconAction: 16,
      iconCard: 18,
      iconBadge: 20,
      dayCircle: 30,
      replyHint: 32,
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
      tagSmall: 22,
    });
    expect(strokeWidth).toMatchObject({ icon: 1.8, action: 2, check: 2.4, send: 1.9, done: 2.2 });
  });

  it("holds the design's font sizes", () => {
    expect(fontSize).toMatchObject({
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
    expect(lineHeight).toMatchObject({
      body: 22.5,
      title: 33.6,
      heading: 31.2,
      heroText: 20.3,
      cardTitle: 19.5,
      small: 21,
      explanation: 18.2,
      quote: 19.5,
    });
    expect(letterSpacing).toMatchObject({
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
    expect(motion).toMatchObject({
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
      replySwipe: 56,
      previewOffset: 8,
      replyHintScale: 0.6,
      swipeSlop: 10,
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

  it("names the four Plus Jakarta Sans faces the app loads", () => {
    expect(fontFamily).toEqual({
      regular: "PlusJakartaSans_400Regular",
      medium: "PlusJakartaSans_500Medium",
      semibold: "PlusJakartaSans_600SemiBold",
      bold: "PlusJakartaSans_700Bold",
    });
  });

  it("holds the withdrawn badge height of correction-thread-entry.html", () => {
    expect(size.tagSmall).toBe(22);
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

  it("holds the reply tokens of chat-reply.html and chat-reply-sent.html", () => {
    expect(colors.quoteSurface).toBe("rgba(0,0,0,0.35)");
    expect(size.replyHint).toBe(32);
    expect(motion.replySwipe).toBe(56);
    expect(motion.previewOffset).toBe(8);
    expect(motion.replyHintScale).toBe(0.6);
    expect(motion.swipeSlop).toBe(10);
  });

  it("holds the practice tokens of the five design files", () => {
    expect({
      miss: colors.miss,
      missSurface: colors.missSurface,
      missLine: colors.missLine,
    }).toEqual({
      miss: "#C77D44",
      missSurface: "#1F1408",
      missLine: "#6B4423",
    });
    expect({
      ringSmall: size.ringSmall,
      ringSmallRadius: size.ringSmallRadius,
      ringLarge: size.ringLarge,
      ringLargeRadius: size.ringLargeRadius,
      segment: size.segment,
      option: size.option,
      checkBadge: size.checkBadge,
      radio: size.radio,
      sheetBadge: size.sheetBadge,
      rowBadge: size.rowBadge,
      gapSlot: size.gapSlot,
      iconTiny: size.iconTiny,
      sparkLarge: size.sparkLarge,
      sparkMedium: size.sparkMedium,
      sparkSmall: size.sparkSmall,
    }).toEqual({
      ringSmall: 64,
      ringSmallRadius: 28,
      ringLarge: 128,
      ringLargeRadius: 56,
      segment: 6,
      option: 56,
      checkBadge: 26,
      radio: 24,
      sheetBadge: 28,
      rowBadge: 24,
      gapSlot: 120,
      iconTiny: 12,
      sparkLarge: 6,
      sparkMedium: 5,
      sparkSmall: 4,
    });
    expect({
      sparkSide: spacing.sparkSide,
      sparkTop: spacing.sparkTop,
      sparkEdge: spacing.sparkEdge,
      sparkTopMid: spacing.sparkTopMid,
      sparkInset: spacing.sparkInset,
    }).toEqual({ sparkSide: 6, sparkTop: 20, sparkEdge: 4, sparkTopMid: 34, sparkInset: 26 });
    expect(strokeWidth.ringSmall).toBe(6);
    expect(strokeWidth.ringLarge).toBe(10);
    expect(strokeWidth.badge).toBe(3);
    expect(borderWidth.slot).toBe(2);
    expect({ segment: radius.segment, sheet: radius.sheet, picker: radius.picker }).toEqual({
      segment: 3,
      sheet: 28,
      picker: 22,
    });
  });

  it("holds the practice type scale", () => {
    expect({
      option: fontSize.option,
      buttonLarge: fontSize.buttonLarge,
      prompt: fontSize.prompt,
      score: fontSize.score,
      resultTitle: fontSize.resultTitle,
      sheetTitle: fontSize.sheetTitle,
    }).toEqual({
      option: 16,
      buttonLarge: 16,
      prompt: 22,
      score: 32,
      resultTitle: 24,
      sheetTitle: 17,
    });
    expect({
      tileText: lineHeight.tileText,
      hint: lineHeight.hint,
      prompt: lineHeight.prompt,
      source: lineHeight.source,
      answer: lineHeight.answer,
    }).toEqual({ tileText: 16.8, hint: 18.85, prompt: 33, source: 27, answer: 24 });
    expect({
      eyebrow: letterSpacing.eyebrow,
      prompt: letterSpacing.prompt,
      score: letterSpacing.score,
      resultTitle: letterSpacing.resultTitle,
    }).toEqual({ eyebrow: 0.96, prompt: -0.22, score: -0.64, resultTitle: -0.48 });
  });

  it("holds the practice glows as accent shadows with an iOS only radius", () => {
    expect(shadow.cardGlow).toEqual({
      shadowColor: colors.accentGlow,
      shadowOffset: { width: 0, height: 0 },
      shadowOpacity: 1,
      shadowRadius: 11,
    });
    expect(shadow.dayGlow).toEqual({
      shadowColor: colors.accentBubbleLine,
      shadowOffset: { width: 0, height: 0 },
      shadowOpacity: 1,
      shadowRadius: 6,
    });
    expect(shadow.halo).toEqual({
      shadowColor: colors.accentRing,
      shadowOffset: { width: 0, height: 0 },
      shadowOpacity: 1,
      shadowRadius: 20,
    });
  });

  it("holds the practice motion converted from the cycles of the design files", () => {
    expect(motion.rise).toEqual([0.2, 0.7, 0.2, 1]);
    expect(motion.ring).toEqual([0.3, 0.7, 0.2, 1]);
    expect(motion.sheet).toEqual([0.2, 0.8, 0.2, 1]);
    // home.html: 7 s cycle
    expect(motion.home.riseDuration).toBe(Math.round(0.12 * 7000));
    expect(motion.home.riseStagger).toBe(120);
    expect(motion.home.ringDelay).toBe(Math.round(0.08 * 7000));
    expect(motion.home.ringDuration).toBe(Math.round((0.3 - 0.08) * 7000));
    expect(motion.home.popDelay).toBe(Math.round(0.14 * 7000));
    expect(motion.home.popUp).toBe(Math.round((0.2 - 0.14) * 7000));
    expect(motion.home.popSettle).toBe(Math.round((0.24 - 0.2) * 7000));
    expect(motion.home.popScale).toBe(1.2);
    expect(motion.home.glowCycle).toBe(3200);
    expect(motion.home.nudgeCycle).toBe(1600);
    // practice-focus.html: 6 s cycle
    expect(motion.focus.riseDuration).toBe(Math.round(0.14 * 6000));
    expect(motion.focus.riseStagger).toBe(100);
    // exercise-choose.html and exercise-not-quite.html: 5 s cycle
    expect(motion.exercise.fillDuration).toBe(Math.round(0.2 * 5000));
    expect(motion.exercise.pickDuration).toBe(Math.round(0.06 * 5000));
    expect(motion.exercise.checkDelay).toBe(Math.round(0.04 * 5000));
    expect(motion.exercise.sheetDelayRight).toBe(Math.round(0.1 * 5000));
    expect(motion.exercise.sheetDelayMiss).toBe(Math.round(0.14 * 5000));
    expect(motion.exercise.sheetDuration).toBe(Math.round(0.1 * 5000));
    expect(motion.exercise.shakeStep).toBe(Math.round(0.04 * 5000));
    expect(motion.exercise.shake).toEqual([-8, 7, -5, 3, 0]);
    expect(motion.exercise.wrongDuration).toBe(Math.round(0.04 * 5000));
    // practice-result.html: 6 s cycle
    expect(motion.result.ringDelay).toBe(Math.round(0.06 * 6000));
    expect(motion.result.ringDuration).toBe(Math.round(0.28 * 6000));
    expect(motion.result.riseDelay).toBe(Math.round(0.3 * 6000));
    expect(motion.result.riseDuration).toBe(Math.round(0.12 * 6000));
    expect(motion.result.haloCycle).toBe(3000);
    expect(motion.result.sparkIn).toBe(Math.round(0.15 * 6000));
    expect(motion.result.sparkOut).toBe(Math.round(0.25 * 6000));
    expect(motion.result.sparkStagger).toEqual([0, 200, 350]);
  });

  it("holds the study note tokens of note-in-chat.html and note.html", () => {
    expect(size.messageNoteMaxWidth).toBe("86%");
    expect(size.noteIcon).toBe(32);
    expect(radius.noteIcon).toBe(10);
    expect(motion.note.rowDuration).toBe(Math.round(0.14 * 6000));
    expect(motion.note.rowDelay).toBe(100);
    expect(motion.note.rowStagger).toBe(150);
    expect(motion.note.rowOffset).toBe(-10);
    expect(motion.note.enterDuration).toBe(Math.round((0.24 - 0.1) * 5000));
    expect(motion.note.savedDelay).toBe(Math.round((0.3 - 0.1) * 5000));
    expect(motion.note.savedDuration).toBe(Math.round((0.38 - 0.3) * 5000));
    expect(motion.note.savedScale).toBe(0.8);
  });

  it("holds the title and rename tokens of chat-title.html and chat-rename.html", () => {
    expect(colors.scrim).toBe("rgba(0,0,0,0.6)");
    expect(size.grabberWidth).toBe(40);
    expect(size.grabberHeight).toBe(5);
    expect(radius.grabber).toBe(3);
    expect(motion.title.swapOut).toBe(Math.round((0.4 - 0.3) * 5000));
    expect(motion.title.swapInDelay).toBe(Math.round((0.38 - 0.3) * 5000));
    expect(motion.title.swapIn).toBe(Math.round((0.5 - 0.38) * 5000));
    expect(motion.title.swapOffset).toBe(6);
    expect(motion.rename.sheetDuration).toBe(Math.round((0.24 - 0.1) * 5000));
  });

  it("holds the perfect day tokens of home-perfect-day.html", () => {
    expect(colors.flameLight).toBe("#9CC4D6");
    expect(colors.flameMid).toBe("#2E8C93");
    expect(colors.flameCore).toBe("#F2FBFD");
    expect(colors.flameHighlight).toBe("#FFFFFF");
    expect(colors.flameShade).toBe("rgba(0,0,0,0.25)");
    expect(colors.accentFlame).toBe("rgba(109,165,192,0.6)");
    expect(size.flameWidth).toBe(44);
    expect(size.flameHeight).toBe(40);
    expect(shadow.flameGlow).toEqual({
      shadowColor: colors.accentFlame,
      shadowOffset: { width: 0, height: 0 },
      shadowOpacity: 1,
      shadowRadius: 5,
    });
    expect(gradient).toEqual({
      flameBody: [
        { offset: 0, color: colors.flameLight },
        { offset: 0.5, color: colors.flameMid },
        { offset: 1, color: colors.accentLine },
      ],
      flameCore: [
        { offset: 0, color: colors.flameCore },
        { offset: 1, color: colors.accent },
      ],
      flameHighlight: [
        { offset: 0, color: colors.flameHighlight, opacity: 0.5 },
        { offset: 1, color: colors.flameHighlight, opacity: 0 },
      ],
    });
    expect(motion.flame).toEqual({
      cycle: 1200,
      scaleX: [0.94, 1.04, 0.97, 1],
      scaleY: [1.07, 0.95, 1.05, 1],
      skewX: [-3, 2, -1.5, 0],
      origin: "50% 95%",
    });
  });
});
