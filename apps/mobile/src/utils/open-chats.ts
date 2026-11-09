import { sessionTitle, type ActiveSession, type Session } from "@fluency-lab/shared";

import type { IconName } from "@/components/icon";
import type { DataFailure, DataOutcome } from "@/data/data-port";
import type { PromptButton } from "@/utils/chat-state";
import { shortRelativeTime } from "@/utils/relative-time";
import { sessionIcon } from "@/utils/topic-icon";

export type OpenChatRowView = {
  id: string;
  title: string;
  // INFO: the chat's type: the topic label, or Free chat.
  tag: string;
  time: string | null;
  preview: string | null;
  icon: IconName;
};

export function openChatRow(open: ActiveSession, now: number): OpenChatRowView {
  const text = open.lastMessage?.text.replace(/\s+/g, " ").trim() ?? "";
  return {
    id: open.session.id,
    title: open.session.title,
    tag: sessionTitle(open.session.topicId),
    time: shortRelativeTime(open.lastMessage?.createdAt ?? open.session.updatedAt, now),
    preview: text === "" ? null : text,
    icon: sessionIcon(open.session.topicId),
  };
}

export type OpenChatsState =
  | { kind: "loading" }
  | { kind: "failed"; failure: DataFailure }
  | { kind: "empty" }
  | {
      kind: "ready";
      sessions: ActiveSession[];
      loadedAt: number;
      actionFailure: DataFailure | null;
    };

export type OpenChatsEvent =
  | { type: "load_started" }
  | { type: "loaded"; outcome: DataOutcome<ActiveSession[]>; loadedAt: number }
  | { type: "action_done"; sessionId: string; outcome: DataOutcome<unknown> }
  // INFO: the owner renamed a chat from the sheet; the row keeps its place and its last message.
  | { type: "title_saved"; session: Session };

export const initialOpenChats: OpenChatsState = { kind: "loading" };

export function openChatsFromRead(
  outcome: DataOutcome<ActiveSession[]>,
  loadedAt: number,
): OpenChatsState {
  if (!outcome.ok) return { kind: "failed", failure: outcome.failure };
  if (outcome.value.length === 0) return { kind: "empty" };
  return { kind: "ready", sessions: outcome.value, loadedAt, actionFailure: null };
}

export function openChatsReducer(state: OpenChatsState, event: OpenChatsEvent): OpenChatsState {
  switch (event.type) {
    case "load_started":
      return initialOpenChats;
    case "loaded":
      return openChatsFromRead(event.outcome, event.loadedAt);
    case "title_saved": {
      if (state.kind !== "ready") return state;
      const { session } = event;
      if (!state.sessions.some((open) => open.session.id === session.id)) return state;
      return {
        ...state,
        sessions: state.sessions.map((open) =>
          open.session.id === session.id ? { ...open, session } : open,
        ),
      };
    }
    case "action_done": {
      if (state.kind !== "ready") return state;
      const { outcome, sessionId } = event;
      // INFO: not_found means the session is already gone, so the row leaves as on success.
      const gone = outcome.ok || outcome.failure === "not_found";
      if (!gone) return { ...state, actionFailure: outcome.failure };
      const sessions = state.sessions.filter((open) => open.session.id !== sessionId);
      if (sessions.length === 0) return { kind: "empty" };
      return { ...state, sessions, actionFailure: null };
    }
  }
}

export const deletePromptTitle = "Delete this chat?";
export const deletePromptMessage = "This can't be undone.";

export function deletePromptButtons(onDelete: () => void, onCancel: () => void): PromptButton[] {
  return [
    { text: "Cancel", style: "cancel", onPress: onCancel },
    { text: "Delete", style: "destructive", onPress: onDelete },
  ];
}
