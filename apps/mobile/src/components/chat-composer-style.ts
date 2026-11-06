import type { TextStyle, ViewStyle } from "react-native";

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

export const MAX_COMPOSER_LINES = 5;
// INFO: the padding centres one body line in a control, so one line keeps the pill's height.
const composerPaddingVertical = (size.control - lineHeight.body) / 2;
export const composerMaxHeight = MAX_COMPOSER_LINES * lineHeight.body + 2 * composerPaddingVertical;

export function composerLines(height: number): number {
  const lines = Math.round((height - 2 * composerPaddingVertical) / lineHeight.body);
  return Math.min(Math.max(lines, 1), MAX_COMPOSER_LINES);
}

// INFO: chat-reply.html draws the form with 10 on top under a reply preview; the other chat
// designs draw 12.
// A thread draws the composer 4 below its quick-ask chips, which carry their own 10.
export function composerRowStyle(replying: boolean, belowChips = false): ViewStyle {
  return {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: spacing.cluster,
    paddingTop: belowChips ? spacing.xs : replying ? spacing.cluster : spacing.group,
    paddingHorizontal: spacing.md,
  };
}

export function composerInputStyle({ locked, lines }: { locked: boolean; lines: number }): {
  input: TextStyle;
  placeholderColor: string;
} {
  const common: TextStyle = {
    flex: 1,
    minHeight: size.control,
    paddingVertical: composerPaddingVertical,
    paddingHorizontal: spacing.screenSide,
    borderRadius: lines > 1 ? radius.control : radius.pill,
    borderWidth: borderWidth.thin,
    fontFamily: fontFamily.regular,
    fontSize: fontSize.body,
    lineHeight: lineHeight.body,
    maxHeight: composerMaxHeight,
  };
  if (locked) {
    return {
      input: {
        ...common,
        backgroundColor: colors.surfaceDisabled,
        borderColor: colors.borderDisabled,
        color: colors.textDisabled,
      },
      placeholderColor: colors.textDisabled,
    };
  }
  return {
    input: {
      ...common,
      backgroundColor: colors.surfaceRaised,
      borderColor: colors.borderRaised,
      color: colors.text,
      ...shadow.floating,
    },
    placeholderColor: colors.textPlaceholder,
  };
}

export function sendButtonStyle({ enabled, pressed }: { enabled: boolean; pressed: boolean }): {
  button: ViewStyle;
  glow: ViewStyle | null;
  icon: string;
} {
  const common: ViewStyle = {
    width: size.control,
    height: size.control,
    borderRadius: radius.pill,
    borderWidth: borderWidth.thin,
    alignItems: "center",
    justifyContent: "center",
  };
  if (!enabled) {
    return {
      button: {
        ...common,
        backgroundColor: colors.surfaceDisabled,
        borderColor: colors.borderDisabled,
      },
      glow: null,
      icon: colors.textDisabled,
    };
  }
  return {
    button: {
      ...common,
      backgroundColor: pressed ? colors.accentPressed : colors.accentLine,
      borderColor: colors.accentPressed,
      ...shadow.floating,
    },
    glow: shadow.glow,
    icon: colors.text,
  };
}
