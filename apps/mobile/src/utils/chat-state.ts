import {
  sessionTitle,
  topicLabel,
  type MonthSpend,
  type Profile,
  type Provider,
  type SessionWithMessages,
} from "@fluency-lab/shared";

import type { FailureCause } from "@/auth/auth-port";
import type { DataOutcome } from "@/data/data-port";
import type { KeyPresenceOutcome } from "@/keys/key-port";
import {
  chatFailureView,
  endedSessionMessage,
  unsupportedProviderMessage,
  type ChatFailureView,
} from "@/utils/chat-failure";
import {
  sendState,
  startConversation,
  type ContextEvent,
  type ContextFields,
  type Conversation,
  type ConversationEvent,
} from "@/utils/chat-conversation";
import type { ChatOrigin } from "@/utils/chat-opening";
import { keyReadFailureMessage } from "@/utils/data-message";
import { dataFailedView } from "@/utils/load-failure";
import { hasText } from "@/utils/has-text";
import { providerOptions } from "@/utils/onboarding-options";
import { tutorName } from "@/utils/chat-reply";
import { spendWarningText } from "@/utils/spend-limit";

export type ChatView =
  | { kind: "loading" }
  | { kind: "no_key" }
  | { kind: "ready"; conversation: Conversation }
  | { kind: "failed"; message: string; cause?: FailureCause; network?: true; retrying?: true };

export const noKeyProviderLine = "No AI connected";

export { MAX_MESSAGE_LENGTH } from "@/utils/chat-conversation";

// INFO: spend and opened are null when they were not read: with no key nothing else is read,
// and only a resumed session is opened.
export function chatView(input: {
  key: KeyPresenceOutcome;
  profile: DataOutcome<Profile>;
  spend: DataOutcome<MonthSpend> | null;
  origin: ChatOrigin;
  opened: DataOutcome<SessionWithMessages> | null;
}): ChatView {
  const { key, profile, spend, origin, opened } = input;
  if (!key.ok) return { kind: "failed", message: keyReadFailureMessage, cause: key.cause };
  if (!key.value) return { kind: "no_key" };
  if (!profile.ok) return dataFailedView(profile.failure);
  if (spend !== null && !spend.ok) {
    return dataFailedView(spend.failure);
  }
  if (opened !== null && !opened.ok) {
    return dataFailedView(opened.failure);
  }
  if (opened !== null && opened.value.session.status === "ended") {
    return { kind: "failed", message: endedSessionMessage };
  }
  const conversation = startConversation({
    origin,
    profile: profile.value,
    spentUsd: spend === null ? 0 : spend.value.spentUsd,
    opened: opened === null ? undefined : opened.value,
  });
  return { kind: "ready", conversation };
}

// INFO: a resumed session's title is known only once it is opened, which needs a key.
export function originTitle(origin: ChatOrigin): string {
  if (origin.kind === "starter") return origin.starter.title;
  if (origin.kind === "topic") return topicLabel(origin.topicId);
  return origin.kind === "free" ? "Free chat" : "Chat";
}

// INFO: the session's topic once it exists; before that, the one the chat starts from.
export function chatTopicId(c: Pick<Conversation, "session" | "origin">): string | null {
  if (c.session !== null) return c.session.topicId;
  if (c.origin.kind === "starter") return c.origin.starter.topicId;
  return c.origin.kind === "topic" ? c.origin.topicId : null;
}

// INFO: the header's second line: the chat's type and the tutor, like the Continue card's type.
export function chatSubtitle(topicId: string | null, provider: Provider | null): string {
  return `${sessionTitle(topicId)} · ${tutorName(provider)}`;
}

export function providerLine(provider: Provider | null): string {
  const option = providerOptions.find((candidate) => candidate.id === provider);
  return option === undefined ? "AI connected" : option.label;
}

export function canSend(draft: string, locked: boolean, busy = false): boolean {
  return !locked && !busy && hasText(draft);
}

// INFO: coming back to a ready chat re-reads only the context. A failure stays in the
// conversation, so the draft and the messages are not lost.
export function contextRefresh(input: {
  key: KeyPresenceOutcome;
  profile: DataOutcome<Profile>;
  spend: DataOutcome<MonthSpend>;
}): { kind: "no_key" } | { kind: "event"; event: ContextEvent } {
  const { key, profile, spend } = input;
  if (!key.ok) {
    const failure = { source: "ai", failure: "key_unreadable", cause: key.cause } as const;
    return { kind: "event", event: { type: "context_failed", failure } };
  }
  if (!key.value) return { kind: "no_key" };
  if (!profile.ok) {
    const failure = { source: "data", failure: profile.failure } as const;
    return { kind: "event", event: { type: "context_failed", failure } };
  }
  if (!spend.ok) {
    const failure = { source: "data", failure: spend.failure } as const;
    return { kind: "event", event: { type: "context_failed", failure } };
  }
  return {
    kind: "event",
    event: {
      type: "context_refreshed",
      provider: profile.value.provider,
      limitUsd: profile.value.monthlyLimitUsd,
      spentUsd: spend.value.spentUsd,
    },
  };
}

// INFO: coming back from a thread re-reads the session, to update the corrections and the
// reply counts of the messages the chat already has. A failure stays in the conversation.
export function threadsRefresh(opened: DataOutcome<SessionWithMessages>): ConversationEvent {
  if (!opened.ok) {
    return { type: "context_failed", failure: { source: "data", failure: opened.failure } };
  }
  return { type: "threads_refreshed", opened: opened.value };
}

export type ChatNotice =
  | { kind: "failure"; view: ChatFailureView }
  | { kind: "unsupported"; message: string }
  | { kind: "limit"; view: ChatFailureView }
  | { kind: "warning"; message: string }
  | null;

// INFO: at most one notice shows above the input; a failure comes first.
export function chatNotice(c: ContextFields): ChatNotice {
  if (c.failure !== null) return { kind: "failure", view: chatFailureView(c.failure) };
  const { notice } = sendState(c);
  if (notice === "unsupported") return { kind: "unsupported", message: unsupportedProviderMessage };
  if (notice === "limit") return { kind: "limit", view: chatFailureView({ source: "limit" }) };
  if (notice === "warning") return { kind: "warning", message: spendWarningText };
  return null;
}

export const endPromptTitle = "End this session?";

// INFO: structurally an AlertButton[], so this file imports nothing from react-native.
export type PromptButton = {
  text: string;
  style: "cancel" | "destructive";
  onPress?: () => void;
};

export function endPromptButtons(onEnd: () => void): PromptButton[] {
  return [
    { text: "Cancel", style: "cancel" },
    { text: "End", style: "destructive", onPress: onEnd },
  ];
}
