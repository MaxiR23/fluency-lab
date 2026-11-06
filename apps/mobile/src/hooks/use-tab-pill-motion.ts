import { useReducedMotion } from "react-native-reanimated";

import { type PillMotion, tabPillMotion } from "@/utils/tab-bar";

// INFO: Reanimated reads the setting when the app starts and does not re-render on change.
export function useTabPillMotion(): PillMotion | null {
  return tabPillMotion(useReducedMotion());
}
