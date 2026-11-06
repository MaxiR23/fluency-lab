import {
  topicLabel,
  type Profile,
  type Session,
  type SessionSummary,
  type TopicId,
} from "@fluency-lab/shared";

import type { DataFailure, DataOutcome } from "@/data/data-port";
import { firstOf, type Param } from "@/utils/chat-opening";

export type SummaryFrom = "chat" | "history";

export type SummaryState =
  | { kind: "loading" }
  | { kind: "failed"; failure: DataFailure }
  | { kind: "ready"; profile: Profile; summary: SessionSummary };

export type SummaryEvent =
  | { type: "load_started" }
  | { type: "loaded"; profile: DataOutcome<Profile>; summary: DataOutcome<SessionSummary> };

export const noCorrectionsText = "No corrections this time.";

// INFO: a screen opened without a session id has nothing to read, so it is a not_found.
export function initialSummary(sessionId: string | null): SummaryState {
  return sessionId === null ? { kind: "failed", failure: "not_found" } : { kind: "loading" };
}

export function summaryFromReads(
  profile: DataOutcome<Profile>,
  summary: DataOutcome<SessionSummary>,
): SummaryState {
  if (!profile.ok) return { kind: "failed", failure: profile.failure };
  if (!summary.ok) return { kind: "failed", failure: summary.failure };
  return { kind: "ready", profile: profile.value, summary: summary.value };
}

export function summaryReducer(_state: SummaryState, event: SummaryEvent): SummaryState {
  switch (event.type) {
    case "load_started":
      return { kind: "loading" };
    case "loaded":
      return summaryFromReads(event.profile, event.summary);
  }
}

export function summaryParams(params: { session?: Param; from?: Param }): {
  sessionId: string | null;
  from: SummaryFrom;
} {
  return {
    sessionId: firstOf(params.session) ?? null,
    from: firstOf(params.from) === "history" ? "history" : "chat",
  };
}

export function summaryHeading(displayName: string | null): string {
  const name = displayName?.trim() ?? "";
  return name === "" ? "Nice work!" : `Nice work, ${name}!`;
}

export function summarySubtitle(session: Session): string {
  if (session.topicId === null) return session.title;
  const topic = topicLabel(session.topicId);
  return session.title === topic ? session.title : `${session.title} · ${topic}`;
}

export function summaryStats(summary: SessionSummary): { value: string; label: string }[] {
  return [
    { value: String(summary.messageCount), label: "Messages" },
    { value: String(summary.corrections.length), label: "Corrections" },
    { value: String(summary.newWords.length), label: "New words" },
  ];
}

export function practiceAgainHref(
  session: Session,
): "/chat" | { pathname: "/chat"; params: { topic: TopicId } } {
  return session.topicId === null
    ? "/chat"
    : { pathname: "/chat", params: { topic: session.topicId } };
}
