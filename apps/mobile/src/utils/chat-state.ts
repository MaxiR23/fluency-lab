import type { Profile, Provider } from "@fluency-lab/shared";

import type { FailureCause } from "@/auth/auth-port";
import type { DataOutcome } from "@/data/data-port";
import type { KeyPresenceOutcome } from "@/keys/key-port";
import { dataFailureMessage, keyReadFailureMessage } from "@/utils/data-message";
import { hasText } from "@/utils/has-text";
import { providerOptions } from "@/utils/onboarding-options";

export type ChatView =
  | { kind: "loading" }
  | { kind: "no_key" }
  | { kind: "ready"; provider: Provider | null }
  | { kind: "failed"; message: string; cause?: FailureCause };

export const noKeyProviderLine = "No AI connected";

export function chatView(key: KeyPresenceOutcome, profile: DataOutcome<Profile>): ChatView {
  if (!key.ok) return { kind: "failed", message: keyReadFailureMessage, cause: key.cause };
  if (!key.value) return { kind: "no_key" };
  if (!profile.ok) return { kind: "failed", message: dataFailureMessage(profile.failure) };
  return { kind: "ready", provider: profile.value.provider };
}

export function chatTitle(topic: string | string[] | undefined): string {
  const first = Array.isArray(topic) ? topic[0] : topic;
  return hasText(first) ? (first as string).trim() : "Free chat";
}

export function providerLine(provider: Provider | null): string {
  const option = providerOptions.find((candidate) => candidate.id === provider);
  return option === undefined ? "AI connected" : option.label;
}

export function canSend(draft: string, locked: boolean): boolean {
  return !locked && hasText(draft);
}
