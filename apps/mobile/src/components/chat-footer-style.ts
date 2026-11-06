import type { ViewStyle } from "react-native";

import { colors } from "@/constants/theme";
import { chatKeyboardLayout } from "@/utils/chat-keyboard";

export function chatFooterStyle(bottomInset: number): ViewStyle {
  return {
    paddingBottom: chatKeyboardLayout(bottomInset).composerBottom,
    backgroundColor: colors.background,
  };
}
