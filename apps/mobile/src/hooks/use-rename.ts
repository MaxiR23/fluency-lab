import { useReducer } from "react";
import type { Session } from "@fluency-lab/shared";

import { data } from "@/data";
import { canSaveTitle, renameSheetReducer, type RenameSheetState } from "@/utils/rename-sheet";

// INFO: the one place that saves a rename; the Chat and Open chats screens both mount it.
// onSaved gets the session as the API returned it.
export function useRename(onSaved: (session: Session) => void): {
  sheet: RenameSheetState;
  open: (sessionId: string, title: string) => void;
  change: (text: string) => void;
  cancel: () => void;
  save: () => Promise<void>;
} {
  const [sheet, dispatch] = useReducer(renameSheetReducer, { kind: "closed" });

  async function save(): Promise<void> {
    if (sheet.kind !== "open" || sheet.saving || !canSaveTitle(sheet.draft, sheet.original)) return;
    dispatch({ type: "save_started" });
    const outcome = await data.setSessionTitle(sheet.sessionId, {
      title: sheet.draft.trim(),
      source: "user",
    });
    if (!outcome.ok) {
      dispatch({ type: "save_failed", failure: outcome.failure });
      return;
    }
    dispatch({ type: "closed" });
    onSaved(outcome.value);
  }

  return {
    sheet,
    open: (sessionId, title) => dispatch({ type: "opened", sessionId, title }),
    change: (text) => dispatch({ type: "draft_changed", text }),
    cancel: () => dispatch({ type: "closed" }),
    save,
  };
}
