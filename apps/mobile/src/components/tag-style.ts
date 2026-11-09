import type { ViewStyle } from "react-native";

import type { TextVariant } from "@/components/text-style";
import { borderWidth, colors, radius, size, spacing } from "@/constants/theme";

export type TagVariant = "tint" | "outline" | "word" | "count" | "withdrawn" | "rule" | "type";

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
  if (variant === "withdrawn") {
    return {
      box: {
        backgroundColor: colors.surface,
        borderColor: colors.border,
        borderWidth: borderWidth.thin,
        borderRadius: radius.badgeSmall,
        minHeight: size.tagSmall,
        paddingHorizontal: spacing.sm,
        justifyContent: "center",
      },
      label: "tab",
    };
  }
  if (variant === "rule") {
    return {
      box: {
        backgroundColor: colors.accentTag,
        borderRadius: radius.pill,
        paddingHorizontal: spacing.cluster,
        paddingVertical: spacing.xs,
      },
      label: "tabActive",
    };
  }
  // INFO: the type tag of chats-open-titles.html: 2 points of vertical padding, where the tint tag has 3.
  if (variant === "type") {
    return {
      box: {
        backgroundColor: colors.accentTag,
        borderRadius: radius.pill,
        paddingHorizontal: spacing.sm,
        paddingVertical: spacing.tight,
        flexShrink: 0,
      },
      label: "tag",
    };
  }
  return {
    box: {
      backgroundColor: colors.accentTag,
      borderRadius: radius.pill,
      paddingHorizontal: spacing.sm,
      paddingVertical: spacing.hair,
    },
    label: variant === "count" ? "tabActive" : "tag",
  };
}
