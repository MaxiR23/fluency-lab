import type { ViewStyle } from "react-native";

import { selectableStyle } from "@/components/selectable-style";
import { borderWidth, colors, radius, size } from "@/constants/theme";

// INFO: the selected row of practice-focus.html: accent-deep with an accent-pressed border, a tag
// tint behind its icon and a filled radio. Unselected, it is the selectable surface.
export function actionCardStyle({ selected, pressed }: { selected: boolean; pressed: boolean }): {
  card: ViewStyle;
  iconBox: ViewStyle;
  radio: ViewStyle;
} {
  return {
    card: selected
      ? { ...selectableStyle({ selected: true }), borderColor: colors.accentPressed }
      : selectableStyle({ selected: false, pressed }),
    iconBox: {
      width: size.badge,
      height: size.badge,
      borderRadius: radius.badge,
      backgroundColor: selected ? colors.accentTag : colors.accentSoft,
      alignItems: "center",
      justifyContent: "center",
    },
    radio: {
      width: size.radio,
      height: size.radio,
      borderRadius: radius.pill,
      borderWidth: borderWidth.thin,
      borderColor: selected ? colors.accentPressed : colors.borderStrong,
      alignItems: "center",
      justifyContent: "center",
      ...(selected ? { backgroundColor: colors.accentLine } : null),
    },
  };
}
