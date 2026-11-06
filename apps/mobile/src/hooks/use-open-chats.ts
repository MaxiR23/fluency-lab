import { useIsFocused } from "expo-router";
import { useEffect, useReducer } from "react";

import { data } from "@/data";
import { initialOpenChats, openChatsReducer, type OpenChatsState } from "@/utils/open-chats";

export function useOpenChats(): {
  state: OpenChatsState;
  retry: () => Promise<void>;
  end: (sessionId: string) => Promise<void>;
  remove: (sessionId: string) => Promise<void>;
} {
  const [state, dispatch] = useReducer(openChatsReducer, initialOpenChats);
  const focused = useIsFocused();

  // INFO: read on every focus, because Chat can end a session and come back here.
  useEffect(() => {
    if (!focused) return;
    let live = true;
    void data.listOpenSessions().then((outcome) => {
      // INFO: a read that ends after the screen unmounts is dropped.
      if (live) dispatch({ type: "loaded", outcome, loadedAt: Date.now() });
    });
    return () => {
      live = false;
    };
  }, [focused]);

  async function retry(): Promise<void> {
    dispatch({ type: "load_started" });
    const outcome = await data.listOpenSessions();
    dispatch({ type: "loaded", outcome, loadedAt: Date.now() });
  }

  async function end(sessionId: string): Promise<void> {
    const outcome = await data.endSession(sessionId);
    dispatch({ type: "action_done", sessionId, outcome });
  }

  async function remove(sessionId: string): Promise<void> {
    const outcome = await data.deleteSession(sessionId);
    dispatch({ type: "action_done", sessionId, outcome });
  }

  return { state, retry, end, remove };
}
