import type { ViewStyle } from "react-native";

import type { TextVariant } from "@/components/text-style";
import { borderWidth, colors, radius, size, spacing } from "@/constants/theme";

export type TagVariant = "tint" | "outline" | "word";

export function tagStyle(variant: TagVariant = "tint"): { box: ViewStyle; label: TextVariant } {
  if (variant === "word") {
    return {
      box: {
        backgroundColor: colors.accentSoft,
        borderColor: colors.accentChipLine,
        borderWidth: borderWidth.thin,
        borderRadius: radius.pill,
        minHeight: size.wordChip,
        paddingHorizontal: spacing.card,
        justifyContent: "center",
      },
      label: "footerLink",
    };
  }
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
