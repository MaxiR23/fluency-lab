import {
  STARTERS,
  TOPIC_IDS,
  sessionTitle,
  starterById,
  topicLabel,
  type Message,
  type Session,
  type Starter,
  type TopicId,
} from "@fluency-lab/shared";

export type ChatOrigin =
  | { kind: "free" }
  | { kind: "starter"; starter: Starter }
  | { kind: "topic"; topicId: TopicId }
  | { kind: "resume"; sessionId: string };

export type Param = string | string[] | undefined;

export function firstOf(param: Param): string | undefined {
  const value = Array.isArray(param) ? param[0] : param;
  return value === undefined || value === "" ? undefined : value;
}

function isTopicId(value: string): value is TopicId {
  return TOPIC_IDS.some((id) => id === value);
}

// INFO: a session id wins over a starter, a starter over a topic; an unknown starter or topic
// is a free chat.
export function chatOrigin(params: {
  starter?: Param;
  session?: Param;
  topic?: Param;
}): ChatOrigin {
  const sessionId = firstOf(params.session);
  if (sessionId !== undefined) return { kind: "resume", sessionId };
  const starterId = firstOf(params.starter);
  const starter = starterId === undefined ? undefined : starterById(starterId);
  if (starter !== undefined) return { kind: "starter", starter };
  const topicId = firstOf(params.topic);
  return topicId !== undefined && isTopicId(topicId)
    ? { kind: "topic", topicId }
    : { kind: "free" };
}

export function topicGreeting(displayName: string | null, topicId: TopicId): string {
  const name = displayName?.trim() ?? "";
  const hi = name === "" ? "Hi!" : `Hi ${name}!`;
  return `${hi} Today's topic: ${topicLabel(topicId)}. What would you like to talk about?`;
}

export function freeChatGreeting(displayName: string | null): string {
  const name = displayName?.trim() ?? "";
  return name === ""
    ? "Hi! What would you like to talk about today?"
    : `Hi ${name}! What would you like to talk about today?`;
}

// INFO: null is a free chat. A goal starter has no topic but a title of its own.
export function promptTopic(session: Session, opening: string | null): string | null {
  // INFO: an automatic or a user title names the chat, not the tutor's topic. A goal starter's own
  // title is gone from the session then, so its opener (the first tutor line) tells which it was.
  if (session.titleSource !== "default") {
    if (session.topicId !== null) return topicLabel(session.topicId);
    return STARTERS.find((starter) => starter.opener === opening)?.title ?? null;
  }
  return session.topicId === null && session.title === sessionTitle(null) ? null : session.title;
}

export function openingOf(messages: readonly Message[]): string | null {
  const first = messages.at(0);
  return first !== undefined && first.role === "tutor" ? first.text : null;
}
