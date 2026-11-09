import { useReducedMotion } from "react-native-reanimated";

import { offlineMotion, type OfflineMotion } from "@/utils/offline-motion";

// INFO: Reanimated reads the setting when the app starts and does not re-render on change.
export function useOfflineMotion(): OfflineMotion | null {
  return offlineMotion(useReducedMotion());
}
