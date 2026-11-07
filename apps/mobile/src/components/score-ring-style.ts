import type { ViewStyle } from "react-native";

import type { TextVariant } from "@/components/text-style";
import { colors, radius, size, spacing, strokeWidth } from "@/constants/theme";

export type ScoreRingSize = "small" | "large";

// INFO: the small ring is the one of home.html (64, radius 28, stroke 6); the large one is the
// result's (128, radius 56, stroke 10) with a halo and three sparks around it.
export function scoreRingStyle(ringSize: ScoreRingSize): {
  box: ViewStyle;
  diameter: number;
  radius: number;
  strokeWidth: number;
  track: string;
  progress: string;
  count: TextVariant;
  sparks: ViewStyle[];
} {
  const large = ringSize === "large";
  const diameter = large ? size.ringLarge : size.ringSmall;
  const spark = (extra: ViewStyle, dimension: number): ViewStyle => ({
    position: "absolute",
    width: dimension,
    height: dimension,
    borderRadius: radius.pill,
    backgroundColor: colors.accent,
    ...extra,
  });
  return {
    box: large
      ? { width: diameter, height: diameter, borderRadius: radius.pill }
      : { width: diameter, height: diameter },
    diameter,
    radius: large ? size.ringLargeRadius : size.ringSmallRadius,
    strokeWidth: large ? strokeWidth.ringLarge : strokeWidth.ringSmall,
    track: colors.accentLine,
    progress: colors.accent,
    count: large ? "score" : "ringCount",
    sparks: [
      spark({ left: spacing.sparkSide, top: spacing.sparkTop }, size.sparkLarge),
      spark({ right: spacing.sparkEdge, top: spacing.sparkTopMid }, size.sparkMedium),
      spark({ right: spacing.sparkInset, top: 0 }, size.sparkSmall),
    ],
  };
}
