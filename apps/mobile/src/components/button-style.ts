import type { TextStyle, ViewStyle } from "react-native";

import { borderWidth, colors, fontFamily, fontSize, radius, spacing } from "@/constants/theme";

export type ButtonVariant = "primary" | "secondary";

type ButtonState = { pressed?: boolean; disabled?: boolean };

type Palette = { background: string; border: string; label: string };

function palette(variant: ButtonVariant, state: ButtonState): Palette {
  if (variant === "primary") {
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

export function buttonStyle(
  variant: ButtonVariant = "primary",
  state: ButtonState = {},
): { container: ViewStyle; label: TextStyle } {
  const { background, border, label } = palette(variant, state);
  return {
    container: {
      backgroundColor: background,
      borderColor: border,
      borderWidth: borderWidth.thin,
      borderRadius: radius.control,
      paddingVertical: spacing.md,
      paddingHorizontal: spacing.lg,
      alignItems: "center",
      justifyContent: "center",
    },
    label: {
      color: label,
      fontFamily: fontFamily.semibold,
      fontSize: fontSize.body,
    },
  };
}
