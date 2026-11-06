import type { FailureCause } from "@/auth/auth-port";

export type KeyFailure = "not_saved" | "not_deleted" | "not_read";

export type KeyOutcome =
  { ok: true; value: null } | { ok: false; failure: KeyFailure; cause?: FailureCause };

export type KeyPresenceOutcome =
  { ok: true; value: boolean } | { ok: false; failure: "not_read"; cause?: FailureCause };

// INFO: hasApiKey tells whether a key is saved and never returns it.
export type KeyPort = {
  saveApiKey(key: string): Promise<KeyOutcome>;
  deleteApiKey(): Promise<KeyOutcome>;
  hasApiKey(): Promise<KeyPresenceOutcome>;
};
