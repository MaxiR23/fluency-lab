import type { ViewStyle } from "react-native";

import { borderWidth, colors, radius } from "@/constants/theme";

export function selectableStyle({
  selected,
  pressed = false,
}: {
  selected: boolean;
  pressed?: boolean;
}): ViewStyle {
  const palette = selected
    ? { backgroundColor: colors.accentDeep, borderColor: colors.accentLine }
    : {
        backgroundColor: colors.surface,
        borderColor: pressed ? colors.accentPressed : colors.border,
      };
  return { ...palette, borderWidth: borderWidth.thin, borderRadius: radius.control };
}
