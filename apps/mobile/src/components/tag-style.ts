import type { ViewStyle } from "react-native";

import type { TextVariant } from "@/components/text-style";
import { borderWidth, colors, radius, size, spacing } from "@/constants/theme";

export type TagVariant = "tint" | "outline";

export function tagStyle(variant: TagVariant = "tint"): { box: ViewStyle; label: TextVariant } {
  if (variant === "outline") {
    return {
      box: {
        backgroundColor: colors.surface,
        borderColor: colors.border,
        borderWidth: borderWidth.thin,
        borderRadius: radius.pill,
        minHeight: size.tag,
        paddingHorizontal: spacing.cluster,
        justifyContent: "center",
      },
      label: "tagOutline",
    };
  }
  return {
    box: {
      backgroundColor: colors.accentTag,
      borderRadius: radius.pill,
      paddingHorizontal: spacing.sm,
      paddingVertical: spacing.hair,
    },
    label: "tag",
  };
}
