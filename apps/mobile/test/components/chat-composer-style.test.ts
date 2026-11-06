// apps/mobile/test/components/chat-composer-style.test.ts
//
// Tests for composerInputStyle and sendButtonStyle.
//
// Tested:
// - The input, open or locked, and its placeholder color
// - The row's top padding, 12 without a reply preview and 10 under one
// - The send button: enabled, pressed, disabled
// - The line count from the input height, the five-line cap and the radius at one line or more
//
// What is covered:
// - Normal case, edges
//
// Run with: pnpm exec jest apps/mobile/test/components/chat-composer-style.test.ts
//
// SEE: apps/mobile/src/components/chat-composer-style.ts

import { describe, expect, it } from "@jest/globals";

import {
  MAX_COMPOSER_LINES,
  composerInputStyle,
  composerLines,
  composerMaxHeight,
  composerRowStyle,
  sendButtonStyle,
} from "@/components/chat-composer-style";
import {
  borderWidth,
  colors,
  fontFamily,
  fontSize,
  lineHeight,
  radius,
  shadow,
  size,
  spacing,
} from "@/constants/theme";

describe("composerInputStyle", () => {
  it("draws the open input raised with the floating shadow", () => {
    expect(composerInputStyle({ locked: false, lines: 1 }).input).toEqual({
      flex: 1,
      minHeight: size.control,
      paddingVertical: (size.control - lineHeight.body) / 2,
      paddingHorizontal: spacing.screenSide,
      borderRadius: radius.pill,
      borderWidth: borderWidth.thin,
      fontFamily: fontFamily.regular,
      fontSize: fontSize.body,
      lineHeight: lineHeight.body,
      maxHeight: composerMaxHeight,
      backgroundColor: colors.surfaceRaised,
      borderColor: colors.borderRaised,
      color: colors.text,
      ...shadow.floating,
    });
  });

  it("draws the locked input dim with no shadow", () => {
    const { input } = composerInputStyle({ locked: true, lines: 1 });
    expect(input).toMatchObject({
      flex: 1,
      minHeight: size.control,
      paddingVertical: (size.control - lineHeight.body) / 2,
      paddingHorizontal: spacing.screenSide,
      borderRadius: radius.pill,
      borderWidth: borderWidth.thin,
      backgroundColor: colors.surfaceDisabled,
      borderColor: colors.borderDisabled,
      color: colors.textDisabled,
    });
    expect(input).not.toHaveProperty("shadowColor");
    expect(input).not.toHaveProperty("elevation");
  });

  it("uses the placeholder color open and the disabled color locked", () => {
    expect(composerInputStyle({ locked: false, lines: 1 }).placeholderColor).toBe(
      colors.textPlaceholder,
    );
    expect(composerInputStyle({ locked: true, lines: 1 }).placeholderColor).toBe(
      colors.textDisabled,
    );
  });

  it("keeps the pill radius at one line", () => {
    expect(composerInputStyle({ locked: false, lines: 1 }).input.borderRadius).toBe(radius.pill);
  });

  it("rounds to the control radius from two lines", () => {
    for (const lines of [2, 5]) {
      expect(composerInputStyle({ locked: false, lines }).input.borderRadius).toBe(radius.control);
    }
  });

  it("keeps the locked input a pill", () => {
    expect(composerInputStyle({ locked: true, lines: 1 }).input.borderRadius).toBe(radius.pill);
  });
});

describe("composerLines", () => {
  it("counts one line at the control height", () => {
    expect(composerLines(size.control)).toBe(1);
  });

  it("counts two lines exactly one body line over the control height", () => {
    expect(composerLines(size.control + lineHeight.body)).toBe(2);
  });

  it("counts a line a fraction off its height as that line", () => {
    expect(composerLines(size.control + lineHeight.body - 0.4)).toBe(2);
    expect(composerLines(size.control + lineHeight.body + 0.4)).toBe(2);
  });

  it("counts one line before the input is laid out", () => {
    expect(composerLines(0)).toBe(1);
  });

  it("stops at five lines at the max height", () => {
    expect(composerLines(composerMaxHeight)).toBe(5);
  });

  it("stops at five lines past the max height", () => {
    expect(composerLines(composerMaxHeight + lineHeight.body)).toBe(5);
  });
});

describe("composerMaxHeight", () => {
  it("fits five body lines: the control height plus four more lines", () => {
    expect(MAX_COMPOSER_LINES).toBe(5);
    expect(composerMaxHeight).toBeCloseTo(size.control + 4 * lineHeight.body);
  });
});

describe("sendButtonStyle", () => {
  const common = {
    width: size.control,
    height: size.control,
    borderRadius: radius.pill,
    borderWidth: borderWidth.thin,
    alignItems: "center",
    justifyContent: "center",
  };

  it("draws the enabled send on accent-line with the floating shadow and glow", () => {
    expect(sendButtonStyle({ enabled: true, pressed: false })).toEqual({
      button: {
        ...common,
        backgroundColor: colors.accentLine,
        borderColor: colors.accentPressed,
        ...shadow.floating,
      },
      glow: shadow.glow,
      icon: colors.text,
    });
  });

  it("draws the pressed send on accent-pressed", () => {
    expect(sendButtonStyle({ enabled: true, pressed: true }).button.backgroundColor).toBe(
      colors.accentPressed,
    );
  });

  it("draws the disabled send dim with no shadow and no glow", () => {
    const style = sendButtonStyle({ enabled: false, pressed: false });
    expect(style).toEqual({
      button: {
        ...common,
        backgroundColor: colors.surfaceDisabled,
        borderColor: colors.borderDisabled,
      },
      glow: null,
      icon: colors.textDisabled,
    });
  });

  it("draws the disabled send dim even when pressed", () => {
    expect(sendButtonStyle({ enabled: false, pressed: true })).toEqual(
      sendButtonStyle({ enabled: false, pressed: false }),
    );
  });
});

describe("composerRowStyle", () => {
  it("keeps the 12 point top padding without a reply", () => {
    expect(composerRowStyle(false)).toEqual({
      flexDirection: "row",
      alignItems: "flex-end",
      gap: spacing.cluster,
      paddingTop: spacing.group,
      paddingHorizontal: spacing.md,
    });
    expect(spacing.group).toBe(12);
  });

  it("tightens the top padding to 10 under a reply preview", () => {
    expect(composerRowStyle(true).paddingTop).toBe(spacing.cluster);
    expect(spacing.cluster).toBe(10);
    expect(composerRowStyle(true).paddingHorizontal).toBe(spacing.md);
  });
});
