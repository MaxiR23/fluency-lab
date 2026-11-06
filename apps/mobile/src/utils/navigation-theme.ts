import type { Theme } from "expo-router";

import { colors } from "@/constants/theme";

export function darkNavigationTheme(base: Theme): Theme {
  return {
    ...base,
    dark: true,
    colors: {
      primary: colors.accent,
      background: colors.background,
      card: colors.surface,
      text: colors.text,
      border: colors.border,
      notification: colors.error,
    },
  };
}
