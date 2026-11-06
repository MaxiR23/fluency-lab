import { useIsFocused } from "expo-router";
import { useEffect, useState } from "react";

import { data } from "@/data";
import { keys } from "@/keys";
import { chatView, type ChatView } from "@/utils/chat-state";

async function readChat(): Promise<ChatView> {
  const [key, profile] = await Promise.all([keys.hasApiKey(), data.getProfile()]);
  return chatView(key, profile);
}

export function useChat(): { view: ChatView; retry: () => Promise<void> } {
  const [view, setView] = useState<ChatView>({ kind: "loading" });
  const focused = useIsFocused();

  // INFO: read on every focus, so the state updates when the key step goes back here.
  useEffect(() => {
    if (!focused) return;
    let live = true;
    void readChat().then((next) => {
      // INFO: a read that ends after Chat unmounts is dropped.
      if (live) setView(next);
    });
    return () => {
      live = false;
    };
  }, [focused]);

  async function retry(): Promise<void> {
    setView({ kind: "loading" });
    setView(await readChat());
  }

  return { view, retry };
}
