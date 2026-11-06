import type { ViewStyle } from "react-native";

import { colors, size } from "@/constants/theme";

export function progressSegments(step: number, total: number): boolean[] {
  const filled = Math.min(Math.max(step, 0), total);
  return Array.from({ length: total }, (_, index) => index < filled);
}

export function segmentStyle(filled: boolean): ViewStyle {
  return {
    flex: 1,
    height: size.progressBar,
    backgroundColor: filled ? colors.accent : colors.border,
  };
}
