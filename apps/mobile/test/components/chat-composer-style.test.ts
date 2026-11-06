// apps/mobile/test/components/chat-composer-style.test.ts
//
// Tests for composerInputStyle and sendButtonStyle.
//
// Tested:
// - The input, open or locked, and its placeholder color
// - The send button: enabled, pressed, disabled
//
// What is covered:
// - Normal case, edges
//
// Run with: pnpm exec jest apps/mobile/test/components/chat-composer-style.test.ts
//
// SEE: apps/mobile/src/components/chat-composer-style.ts

import { describe, expect, it } from "@jest/globals";

import { composerInputStyle, sendButtonStyle } from "@/components/chat-composer-style";
import {
  borderWidth,
  colors,
  fontFamily,
  fontSize,
  radius,
  shadow,
  size,
  spacing,
} from "@/constants/theme";

describe("composerInputStyle", () => {
  it("draws the open input raised with the floating shadow", () => {
    expect(composerInputStyle({ locked: false }).input).toEqual({
      flex: 1,
      minHeight: size.control,
      paddingVertical: 0,
      paddingHorizontal: spacing.screenSide,
      borderRadius: radius.pill,
      borderWidth: borderWidth.thin,
      fontFamily: fontFamily.regular,
      fontSize: fontSize.body,
      backgroundColor: colors.surfaceRaised,
      borderColor: colors.borderRaised,
      color: colors.text,
      ...shadow.floating,
    });
  });

  it("draws the locked input dim with no shadow", () => {
    const { input } = composerInputStyle({ locked: true });
    expect(input).toMatchObject({
      flex: 1,
      minHeight: size.control,
      paddingVertical: 0,
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
    expect(composerInputStyle({ locked: false }).placeholderColor).toBe(colors.textPlaceholder);
    expect(composerInputStyle({ locked: true }).placeholderColor).toBe(colors.textDisabled);
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
