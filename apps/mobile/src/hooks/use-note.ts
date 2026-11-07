import { useEffect, useReducer } from "react";

import { data } from "@/data";
import { initialNote, noteReducer, type NoteState } from "@/utils/note";

export function useNote(noteId: string | null): {
  state: NoteState;
  retry: () => Promise<void>;
  remove: () => Promise<void>;
} {
  const [state, dispatch] = useReducer(noteReducer, noteId, initialNote);

  // INFO: read once: a note is never edited, so it does not change while the screen is away.
  useEffect(() => {
    if (noteId === null) return;
    let live = true;
    void data.getNote(noteId).then((note) => {
      // INFO: a read that ends after the screen unmounts is dropped.
      if (live) dispatch({ type: "loaded", note });
    });
    return () => {
      live = false;
    };
  }, [noteId]);

  async function retry(): Promise<void> {
    if (noteId === null) return;
    dispatch({ type: "load_started" });
    dispatch({ type: "loaded", note: await data.getNote(noteId) });
  }

  async function remove(): Promise<void> {
    if (noteId === null) return;
    dispatch({ type: "delete_started" });
    const deleted = await data.deleteNote(noteId);
    if (!deleted.ok) {
      dispatch({ type: "delete_failed", failure: deleted.failure });
      return;
    }
    dispatch({ type: "delete_done" });
  }

  return { state, retry, remove };
}
