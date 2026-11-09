import type { ViewStyle } from "react-native";

import { borderWidth, colors, radius, size, spacing } from "@/constants/theme";
import { chatKeyboardLayout } from "@/utils/chat-keyboard";

const fill: ViewStyle = { position: "absolute", top: 0, right: 0, bottom: 0, left: 0 };

// INFO: the rename sheet of chat-rename.html. The sheet's bottom is the composer's: 36, or the inset.
export function renameSheetStyle(bottomInset: number): {
  overlay: ViewStyle;
  scrim: ViewStyle;
  dock: ViewStyle;
  sheet: ViewStyle;
  grabberRow: ViewStyle;
  grabber: ViewStyle;
  field: ViewStyle;
  count: ViewStyle;
  buttons: ViewStyle;
  button: ViewStyle;
} {
  return {
    overlay: fill,
    scrim: { ...fill, backgroundColor: colors.scrim },
    dock: { position: "absolute", left: 0, right: 0, bottom: 0 },
    sheet: {
      gap: spacing.md,
      paddingTop: spacing.cluster,
      paddingHorizontal: spacing.screenSide,
      paddingBottom: chatKeyboardLayout(bottomInset).composerBottom,
      borderTopLeftRadius: radius.sheet,
      borderTopRightRadius: radius.sheet,
      backgroundColor: colors.surfaceSunken,
      borderTopWidth: borderWidth.thin,
      borderTopColor: colors.border,
    },
    grabberRow: { alignItems: "center" },
    grabber: {
      width: size.grabberWidth,
      height: size.grabberHeight,
      borderRadius: radius.grabber,
      backgroundColor: colors.borderRaised,
    },
    field: { gap: spacing.sm },
    count: { alignSelf: "flex-end" },
    buttons: { flexDirection: "row", gap: spacing.cluster },
    button: { flex: 1 },
  };
}
