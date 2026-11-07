import type { ViewStyle } from "react-native";

import type { TextVariant } from "@/components/text-style";
import { borderWidth, colors, radius, shadow, size } from "@/constants/theme";
import type { DayCell } from "@/utils/week-strip";

export function dayCircleStyle(cell: DayCell): ViewStyle {
  const base: ViewStyle = {
    width: size.dayCircle,
    height: size.dayCircle,
    borderRadius: radius.pill,
    borderWidth: borderWidth.thin,
    alignItems: "center",
    justifyContent: "center",
  };
  if (cell.practiced) {
    const practiced = {
      ...base,
      backgroundColor: colors.accentLine,
      borderColor: colors.accentPressed,
    };
    // INFO: today's practiced day glows (home.html); iOS only, like the other glows.
    return cell.isToday ? { ...practiced, ...shadow.dayGlow } : practiced;
  }
  if (cell.isFuture) {
    return {
      ...base,
      backgroundColor: colors.surfaceSunken,
      borderColor: colors.borderStrong,
      borderStyle: "dashed",
    };
  }
  return { ...base, backgroundColor: colors.surfaceSunken, borderColor: colors.border };
}

export function dayLetterVariant(cell: DayCell): TextVariant {
  return cell.isToday ? "dayToday" : "day";
}
