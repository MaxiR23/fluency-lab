import { SESSION_TITLE_MAX } from "@fluency-lab/shared";

import type { DataFailure } from "@/data/data-port";
import { dataFailureMessage } from "@/utils/data-message";

export type RenameSheetState =
  | { kind: "closed" }
  | {
      kind: "open";
      sessionId: string;
      original: string;
      draft: string;
      saving: boolean;
      failure: DataFailure | null;
    };

export type RenameSheetEvent =
  | { type: "opened"; sessionId: string; title: string }
  | { type: "draft_changed"; text: string }
  | { type: "save_started" }
  | { type: "save_failed"; failure: DataFailure }
  | { type: "closed" };

export type RenameSheetView = {
  value: string;
  count: string;
  canSave: boolean;
  saving: boolean;
  failure: string | null;
};

export function renameSheetReducer(
  state: RenameSheetState,
  event: RenameSheetEvent,
): RenameSheetState {
  if (event.type === "opened") {
    return {
      kind: "open",
      sessionId: event.sessionId,
      original: event.title,
      draft: event.title,
      saving: false,
      failure: null,
    };
  }
  if (event.type === "closed") return { kind: "closed" };
  if (state.kind === "closed") return state;
  switch (event.type) {
    case "draft_changed":
      return { ...state, draft: event.text.slice(0, SESSION_TITLE_MAX), failure: null };
    case "save_started":
      return { ...state, saving: true, failure: null };
    case "save_failed":
      return { ...state, saving: false, failure: event.failure };
  }
}

// INFO: the trimmed title must be 1 to 60 characters and differ from the trimmed original.
export function canSaveTitle(draft: string, original: string): boolean {
  const title = draft.trim();
  return title.length >= 1 && title.length <= SESSION_TITLE_MAX && title !== original.trim();
}

export function titleCount(draft: string): string {
  return `${draft.length}/${SESSION_TITLE_MAX}`;
}

export function renameSheetView(state: RenameSheetState): RenameSheetView | null {
  if (state.kind === "closed") return null;
  return {
    value: state.draft,
    count: titleCount(state.draft),
    canSave: !state.saving && canSaveTitle(state.draft, state.original),
    saving: state.saving,
    failure: state.failure === null ? null : dataFailureMessage(state.failure),
  };
}
