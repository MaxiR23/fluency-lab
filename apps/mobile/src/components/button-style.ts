import type { TextStyle, ViewStyle } from "react-native";

import {
  borderWidth,
  colors,
  fontFamily,
  fontSize,
  radius,
  size,
  spacing,
} from "@/constants/theme";

export type ButtonVariant = "primary" | "secondary" | "deep";

type ButtonState = { pressed?: boolean; disabled?: boolean };

type Palette = { background: string; border: string; label: string };

function palette(variant: ButtonVariant, state: ButtonState): Palette {
  if (variant === "primary" || variant === "deep") {
    if (state.disabled) {
      return {
        background: colors.surface,
        border: colors.border,
        label: colors.textMuted,
      };
    }
    if (state.pressed) {
      return {
        background: colors.accentPressed,
        border: colors.accentPressed,
        label: colors.text,
      };
    }
    if (variant === "deep") {
      return {
        background: colors.accentDeep,
        border: colors.accentLine,
        label: colors.text,
      };
    }
    return {
      background: colors.accent,
      border: colors.accent,
      label: colors.accentDeep,
    };
  }
  if (state.disabled) {
    return {
      background: colors.background,
      border: colors.border,
      label: colors.textMuted,
    };
  }
  if (state.pressed) {
    return {
      background: colors.surface,
      border: colors.accentPressed,
      label: colors.text,
    };
  }
  return {
    background: colors.surface,
    border: colors.border,
    label: colors.text,
  };
}

function minHeight(options: { compact?: boolean; small?: boolean }): number {
  if (options.small === true) return size.controlSmall;
  return options.compact === true ? size.controlCompact : size.control;
}

export function buttonStyle(
  variant: ButtonVariant = "primary",
  state: ButtonState = {},
  options: { compact?: boolean; small?: boolean } = {},
): { container: ViewStyle; label: TextStyle } {
  const { background, border, label } = palette(variant, state);
  return {
    container: {
      backgroundColor: background,
      borderColor: border,
      borderWidth: borderWidth.thin,
      borderRadius: radius.control,
      minHeight: minHeight(options),
      paddingHorizontal: options.small === true ? spacing.md : spacing.lg,
      alignItems: "center",
      justifyContent: "center",
    },
    label: {
      color: label,
      fontFamily: fontFamily.semibold,
      fontSize: options.small === true ? fontSize.caption : fontSize.body,
    },
  };
}
