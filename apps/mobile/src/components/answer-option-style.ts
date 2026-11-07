import type { ViewStyle } from "react-native";

import { borderWidth, colors, radius, size, spacing } from "@/constants/theme";

export type AnswerOptionState = "idle" | "right" | "wrong";

type Tint = { backgroundColor: string; borderColor: string };

// INFO: from is the look before the answer, to the look after it; the animation moves between them.
export function answerOptionStyle(state: AnswerOptionState): {
  container: ViewStyle;
  from: Tint;
  to: Tint;
  badge: ViewStyle;
  hasBadge: boolean;
} {
  const from: Tint = { backgroundColor: colors.surface, borderColor: colors.border };
  const to: Tint =
    state === "right"
      ? { backgroundColor: colors.accentDeep, borderColor: colors.accent }
      : state === "wrong"
        ? { backgroundColor: colors.surface, borderColor: colors.miss }
        : from;
  return {
    container: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      minHeight: size.option,
      paddingHorizontal: spacing.hero,
      borderRadius: radius.control,
      borderWidth: borderWidth.thin,
      ...to,
    },
    from,
    to,
    badge: {
      width: size.checkBadge,
      height: size.checkBadge,
      borderRadius: radius.pill,
      backgroundColor: state === "wrong" ? colors.miss : colors.accent,
      alignItems: "center",
      justifyContent: "center",
    },
    hasBadge: state !== "idle",
  };
}
