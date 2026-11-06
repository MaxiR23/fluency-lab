import type { ReactNode } from "react";
import { KeyboardStickyView } from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { chatFooterStyle } from "@/components/chat-footer-style";
import { chatKeyboardLayout } from "@/utils/chat-keyboard";

// INFO: the footer is opaque because the list keeps its size and its content scrolls under
// the footer while the keyboard is open.
export function ChatFooter({ children }: { children: ReactNode }) {
  const { bottom } = useSafeAreaInsets();
  return (
    <KeyboardStickyView
      testID="chat-footer"
      offset={{ opened: chatKeyboardLayout(bottom).stickyOffset }}
      style={chatFooterStyle(bottom)}
    >
      {children}
    </KeyboardStickyView>
  );
}
