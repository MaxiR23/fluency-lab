import type { CorrectionThread, MonthSpend, Profile } from "@fluency-lab/shared";

import type { FailureCause } from "@/auth/auth-port";
import type { DataOutcome } from "@/data/data-port";
import type { KeyPresenceOutcome } from "@/keys/key-port";
import { keyReadFailureMessage } from "@/utils/data-message";
import { dataFailedView } from "@/utils/load-failure";
import { startThread, type ThreadConversation } from "@/utils/thread-conversation";

export type ThreadScreenView =
  | { kind: "loading" }
  | { kind: "no_key" }
  | { kind: "ready"; conversation: ThreadConversation }
  | { kind: "failed"; message: string; cause?: FailureCause; network?: true; retrying?: true };

export const threadTitle = "Correction";
export const threadBackLabel = "Back to the chat";
export const threadPlaceholder = "Ask about this correction…";
export const threadNotFoundMessage = "This correction could not be found.";

export const QUICK_ASKS = ["Why is it wrong?", "I think I was right", "Other ways"] as const;

export function threadHref(messageId: string) {
  return { pathname: "/thread", params: { message: messageId } } as const;
}

export function threadParams(params: { message?: string | string[] }): string | null {
  const raw = Array.isArray(params.message) ? params.message[0] : params.message;
  return raw === undefined || raw === "" ? null : raw;
}

// INFO: spend and thread are null when they were not read: with no key nothing else is read,
// as in the chat.
export function threadView(input: {
  key: KeyPresenceOutcome;
  profile: DataOutcome<Profile>;
  spend: DataOutcome<MonthSpend> | null;
  thread: DataOutcome<CorrectionThread> | null;
}): ThreadScreenView {
  const { key, profile, spend, thread } = input;
  if (!key.ok) return { kind: "failed", message: keyReadFailureMessage, cause: key.cause };
  if (!key.value) return { kind: "no_key" };
  if (!profile.ok) return dataFailedView(profile.failure);
  if (spend !== null && !spend.ok) {
    return dataFailedView(spend.failure);
  }
  if (thread !== null && !thread.ok) {
    return dataFailedView(thread.failure);
  }
  if (spend === null || thread === null) return { kind: "loading" };
  // INFO: the database does not check what a thread hangs on; only a learner message that
  // has corrections can open one.
  const { message } = thread.value;
  if (message.role !== "user" || (message.corrections?.items.length ?? 0) === 0) {
    return { kind: "failed", message: threadNotFoundMessage };
  }
  return {
    kind: "ready",
    conversation: startThread({
      thread: thread.value,
      profile: profile.value,
      spentUsd: spend.value.spentUsd,
    }),
  };
}
