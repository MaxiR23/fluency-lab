import type { FailureCause } from "@/auth/auth-port";

export type KeyFailure = "not_saved" | "not_deleted";

export type KeyOutcome =
  { ok: true; value: null } | { ok: false; failure: KeyFailure; cause?: FailureCause };

// INFO: save and delete only. Reading the key belongs to Settings and Chat.
export type KeyPort = {
  saveApiKey(key: string): Promise<KeyOutcome>;
  deleteApiKey(): Promise<KeyOutcome>;
};
