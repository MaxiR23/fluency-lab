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

export type ButtonVariant = "primary" | "secondary" | "deep" | "strong" | "miss";

type ButtonState = { pressed?: boolean; disabled?: boolean; busy?: boolean };

type Palette = { background: string; border: string; label: string };

function palette(variant: ButtonVariant, state: ButtonState): Palette {
  if (variant === "primary" || variant === "deep" || variant === "strong") {
    // INFO: offline-retrying.html: while a retry runs the button keeps a deep fill with a muted label.
    if (state.busy) {
      return {
        background: colors.accentDeep,
        border: colors.accentLine,
        label: colors.textMuted,
      };
    }
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
    if (variant === "strong") {
      return {
        background: colors.accentLine,
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
  if (variant === "miss" && !state.disabled) {
    return {
      background: colors.surface,
      border: state.pressed ? colors.accentPressed : colors.missLine,
      label: colors.text,
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

function minHeight(options: { compact?: boolean; small?: boolean; inline?: boolean }): number {
  if (options.inline === true) return size.touch;
  if (options.small === true) return size.controlSmall;
  return options.compact === true ? size.controlCompact : size.control;
}

function paddingHorizontal(options: { small?: boolean; inline?: boolean }): number {
  if (options.inline === true) return spacing.section;
  return options.small === true ? spacing.md : spacing.lg;
}

function labelSize(options: { small?: boolean; large?: boolean }): number {
  if (options.small === true) return fontSize.caption;
  return options.large === true ? fontSize.buttonLarge : fontSize.body;
}

export function buttonStyle(
  variant: ButtonVariant = "primary",
  state: ButtonState = {},
  options: { compact?: boolean; small?: boolean; large?: boolean; inline?: boolean } = {},
): { container: ViewStyle; label: TextStyle } {
  const { background, border, label } = palette(variant, state);
  return {
    container: {
      backgroundColor: background,
      borderColor: border,
      borderWidth: borderWidth.thin,
      borderRadius: variant === "strong" || options.large === true ? radius.pill : radius.control,
      minHeight: minHeight(options),
      paddingHorizontal: paddingHorizontal(options),
      alignItems: "center",
      justifyContent: "center",
      ...(state.busy === true ? { flexDirection: "row", gap: spacing.cluster } : {}),
    },
    label: {
      color: label,
      fontFamily: fontFamily.semibold,
      fontSize: labelSize(options),
    },
  };
}
