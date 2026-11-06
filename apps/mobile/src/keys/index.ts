import * as SecureStore from "expo-secure-store";

import type { KeyPort } from "@/keys/key-port";
import { createSecureStoreKeys } from "@/keys/secure-store-keys";

// INFO: WHEN_UNLOCKED_THIS_DEVICE_ONLY keeps the key out of backups restored on another device.
export const keys: KeyPort = createSecureStoreKeys({
  setItemAsync: SecureStore.setItemAsync,
  deleteItemAsync: SecureStore.deleteItemAsync,
  keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
});
