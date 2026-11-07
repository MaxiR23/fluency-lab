import type { NoteKind, StudyNote, StudyNoteDraft, StudyNoteShape } from "@fluency-lab/shared";

import type { DataFailure, DataOutcome } from "@/data/data-port";
import { shortDate } from "@/utils/calendar";
import { firstOf, type Param } from "@/utils/chat-opening";
import type { PromptButton } from "@/utils/chat-state";

const PREVIEW_LINES = 3;

export type NotePreviewLine = { lead: string | null; text: string };

export type NoteState =
  | { kind: "loading" }
  | { kind: "failed"; failure: DataFailure }
  | { kind: "ready"; note: StudyNote; deleting: boolean; deleteFailure: DataFailure | null }
  | { kind: "deleted" };

export type NoteEvent =
  | { type: "load_started" }
  | { type: "loaded"; note: DataOutcome<StudyNote> }
  | { type: "delete_started" }
  | { type: "delete_failed"; failure: DataFailure }
  | { type: "delete_done" };

// INFO: the first three rows (the form in bold, then when to use it) or the first three
// points, as the chat card shows them.
export function notePreview(note: StudyNoteShape): NotePreviewLine[] {
  if (note.kind === "summary") {
    return note.content.points.slice(0, PREVIEW_LINES).map((text) => ({ lead: null, text }));
  }
  return note.content.rows.slice(0, PREVIEW_LINES).map(([lead, text]) => ({ lead, text }));
}

// INFO: a summary is drawn as the same table with one column and no header.
export function noteTable(note: StudyNoteShape): {
  columns: readonly string[] | null;
  rows: readonly (readonly string[])[];
} {
  return note.kind === "table"
    ? { columns: note.content.columns, rows: note.content.rows }
    : { columns: null, rows: note.content.points.map((point) => [point]) };
}

// INFO: the note without its ids and dates: what the model sees and the chat card draws.
export function noteDraft(note: StudyNote): StudyNoteDraft {
  return note.kind === "table"
    ? { kind: "table", title: note.title, topic: note.topic, content: note.content }
    : { kind: "summary", title: note.title, topic: note.topic, content: note.content };
}

const KIND_LABELS: Record<NoteKind, string> = { table: "Table", summary: "Summary" };

export function noteSubtitle(kind: NoteKind, topic: string): string {
  return `${KIND_LABELS[kind]} · ${topic}`;
}

export function noteIcon(kind: NoteKind): "table" | "list" {
  return kind === "table" ? "table" : "list";
}

// INFO: a note made from an exercise, and a note whose chat was deleted, have no session.
export function noteTag(note: Pick<StudyNote, "sessionTitle">): string {
  return note.sessionTitle === null ? "Grammar" : `Grammar · from ${note.sessionTitle}`;
}

// INFO: today comes from the API with the page, because the device zone is unreliable.
export function noteDate(day: string, today: string): string {
  return day === today ? "Today" : shortDate(day);
}

export function noteParams(params: { id?: Param }): string | null {
  return firstOf(params.id) ?? null;
}

// INFO: a screen opened without a note id has nothing to read, so it is a not_found.
export function initialNote(noteId: string | null): NoteState {
  return noteId === null ? { kind: "failed", failure: "not_found" } : { kind: "loading" };
}

export function noteReducer(state: NoteState, event: NoteEvent): NoteState {
  switch (event.type) {
    case "load_started":
      return { kind: "loading" };
    case "loaded":
      return event.note.ok
        ? { kind: "ready", note: event.note.value, deleting: false, deleteFailure: null }
        : { kind: "failed", failure: event.note.failure };
    case "delete_started":
      return state.kind === "ready" && !state.deleting
        ? { ...state, deleting: true, deleteFailure: null }
        : state;
    case "delete_failed":
      return state.kind === "ready"
        ? { ...state, deleting: false, deleteFailure: event.failure }
        : state;
    case "delete_done":
      return { kind: "deleted" };
  }
}

export function deleteNotePrompt(onDelete: () => void): {
  title: string;
  message: string;
  buttons: PromptButton[];
} {
  return {
    title: "Delete this note?",
    message: "This can't be undone.",
    buttons: [
      { text: "Cancel", style: "cancel" },
      { text: "Delete", style: "destructive", onPress: onDelete },
    ],
  };
}
