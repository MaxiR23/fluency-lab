import type { KeyPort } from "@/keys/key-port";
import { describeAuthCause } from "@/utils/auth-error";

export const API_KEY_ITEM = "api_key";

export function createSecureStoreKeys<A>(deps: {
  setItemAsync(key: string, value: string, options: { keychainAccessible: A }): Promise<void>;
  deleteItemAsync(key: string): Promise<void>;
  keychainAccessible: A;
}): KeyPort {
  return {
    async saveApiKey(key) {
      try {
        await deps.setItemAsync(API_KEY_ITEM, key, { keychainAccessible: deps.keychainAccessible });
        return { ok: true, value: null };
      } catch (thrown) {
        // INFO: detail is forced to null: describeAuthCause keeps the message of a
        // transport-shaped error, and a native store message could echo the key.
        return {
          ok: false,
          failure: "not_saved",
          cause: { ...describeAuthCause(thrown), detail: null },
        };
      }
    },
    async deleteApiKey() {
      try {
        await deps.deleteItemAsync(API_KEY_ITEM);
        return { ok: true, value: null };
      } catch (thrown) {
        return {
          ok: false,
          failure: "not_deleted",
          cause: { ...describeAuthCause(thrown), detail: null },
        };
      }
    },
  };
}
