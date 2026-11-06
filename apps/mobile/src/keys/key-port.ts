import type { FailureCause } from "@/auth/auth-port";

export type KeyFailure = "not_saved" | "not_deleted" | "not_read";

export type KeyOutcome =
  { ok: true; value: null } | { ok: false; failure: KeyFailure; cause?: FailureCause };

export type KeyPresenceOutcome =
  { ok: true; value: boolean } | { ok: false; failure: "not_read"; cause?: FailureCause };

export type KeyReadOutcome =
  { ok: true; value: string | null } | { ok: false; failure: "not_read"; cause?: FailureCause };

// INFO: hasApiKey tells whether a key is saved and never returns it. readApiKey
// is for the AI wiring only (src/ai/index.ts); screens and hooks never call it.
export type KeyPort = {
  saveApiKey(key: string): Promise<KeyOutcome>;
  deleteApiKey(): Promise<KeyOutcome>;
  hasApiKey(): Promise<KeyPresenceOutcome>;
  readApiKey(): Promise<KeyReadOutcome>;
};
