import { useEffect, useState } from "react";

import { data } from "@/data";
import { suggestionListView, type SuggestionListView } from "@/utils/suggestion-list";
import { retryStarted } from "@/utils/load-failure";

export function useAllSuggestions(): { view: SuggestionListView; retry: () => Promise<void> } {
  const [view, setView] = useState<SuggestionListView>({ kind: "loading" });

  useEffect(() => {
    let live = true;
    void data.getProfile().then((profile) => {
      // INFO: a read that ends after the screen unmounts is dropped.
      if (live) setView(suggestionListView(profile));
    });
    return () => {
      live = false;
    };
  }, []);

  async function retry(): Promise<void> {
    setView((current) => retryStarted<SuggestionListView>(current, { kind: "loading" }));
    setView(suggestionListView(await data.getProfile()));
  }

  return { view, retry };
}
