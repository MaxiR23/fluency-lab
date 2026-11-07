import * as Haptics from "expo-haptics";
import { Storage } from "expo-sqlite/kv-store";

import { createExpoHaptics } from "@/haptics/expo-haptics";
import type { HapticsPort, HapticsSettingPort } from "@/haptics/haptics-port";
import { createKvHapticsSetting } from "@/haptics/kv-haptics-setting";

export const haptics: HapticsPort = createExpoHaptics({
  impactAsync: Haptics.impactAsync,
  selectionAsync: Haptics.selectionAsync,
  notificationAsync: Haptics.notificationAsync,
  light: Haptics.ImpactFeedbackStyle.Light,
  success: Haptics.NotificationFeedbackType.Success,
  error: Haptics.NotificationFeedbackType.Error,
});

// INFO: the same key-value store (expo-sqlite) that already backs the auth session.
export const hapticsSetting: HapticsSettingPort = createKvHapticsSetting(Storage);
