import {
  sessionTitle,
  starterById,
  type Message,
  type Session,
  type Starter,
} from "@fluency-lab/shared";

export type ChatOrigin =
  { kind: "free" } | { kind: "starter"; starter: Starter } | { kind: "resume"; sessionId: string };

type Param = string | string[] | undefined;

function firstOf(param: Param): string | undefined {
  const value = Array.isArray(param) ? param[0] : param;
  return value === undefined || value === "" ? undefined : value;
}

// INFO: a session id wins over a starter; an unknown starter id is a free chat.
export function chatOrigin(params: { starter?: Param; session?: Param }): ChatOrigin {
  const sessionId = firstOf(params.session);
  if (sessionId !== undefined) return { kind: "resume", sessionId };
  const starterId = firstOf(params.starter);
  const starter = starterId === undefined ? undefined : starterById(starterId);
  return starter === undefined ? { kind: "free" } : { kind: "starter", starter };
}

export function freeChatGreeting(displayName: string | null): string {
  const name = displayName?.trim() ?? "";
  return name === ""
    ? "Hi! What would you like to talk about today?"
    : `Hi ${name}! What would you like to talk about today?`;
}

// INFO: null is a free chat. A goal starter has no topic but a title of its own.
export function promptTopic(session: Session): string | null {
  return session.topicId === null && session.title === sessionTitle(null) ? null : session.title;
}

export function openingOf(messages: readonly Message[]): string | null {
  const first = messages.at(0);
  return first !== undefined && first.role === "tutor" ? first.text : null;
}
