import { useReducedMotion } from "react-native-reanimated";

import { chatMotion, type ChatMotion } from "@/utils/chat-motion";

// INFO: Reanimated reads the setting when the app starts and does not re-render on change.
export function useChatMotion(): ChatMotion {
  return chatMotion(useReducedMotion());
}
