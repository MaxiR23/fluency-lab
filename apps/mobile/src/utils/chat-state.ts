import type { FailureCause } from "@/auth/auth-port";
import type { KeyPresenceOutcome } from "@/keys/key-port";

export type ChatKeyView =
  | { kind: "loading" }
  | { kind: "no_key" }
  | { kind: "ready" }
  | { kind: "failed"; cause?: FailureCause };

export function chatKeyView(outcome: KeyPresenceOutcome): ChatKeyView {
  if (!outcome.ok) return { kind: "failed", cause: outcome.cause };
  return outcome.value ? { kind: "ready" } : { kind: "no_key" };
}
