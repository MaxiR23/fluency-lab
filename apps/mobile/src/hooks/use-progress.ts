import { useIsFocused } from "expo-router";
import { useEffect, useReducer, useState } from "react";

import { data } from "@/data";
import {
  initialProgress,
  nextPageOffset,
  progressReducer,
  type ProgressSection,
  type ProgressState,
} from "@/utils/progress";
import { deviceTimeZone } from "@/utils/time-zone";

function readProgress() {
  const timeZone = deviceTimeZone();
  return Promise.all([
    data.getMonthProgress(timeZone),
    data.listHistory(timeZone, 0),
    data.listMistakes(0),
    data.listWords(timeZone, 0),
    data.listNotes(timeZone, 0),
  ]);
}

export function useProgress(): {
  state: ProgressState;
  section: ProgressSection;
  select: (section: ProgressSection) => void;
  retry: () => Promise<void>;
  loadMore: () => Promise<void>;
  retryMore: () => Promise<void>;
} {
  const [state, dispatch] = useReducer(progressReducer, initialProgress);
  const [section, setSection] = useState<ProgressSection>("history");
  const focused = useIsFocused();

  // INFO: read on every focus, so a chat ended elsewhere shows when Progress comes back.
  useEffect(() => {
    if (!focused) return;
    let live = true;
    void readProgress().then(([month, history, mistakes, words, notes]) => {
      // INFO: a read that ends after Progress unmounts is dropped.
      if (live) dispatch({ type: "loaded", month, history, mistakes, words, notes });
    });
    return () => {
      live = false;
    };
  }, [focused]);

  async function retry(): Promise<void> {
    dispatch({ type: "load_started" });
    const [month, history, mistakes, words, notes] = await readProgress();
    dispatch({ type: "loaded", month, history, mistakes, words, notes });
  }

  async function readNext(mode: "auto" | "retry"): Promise<void> {
    const offset = nextPageOffset(state, section, mode);
    if (offset === null) return;
    dispatch({ type: "more_started", section });
    const timeZone = deviceTimeZone();
    switch (section) {
      case "history":
        dispatch({
          type: "more_loaded",
          section,
          offset,
          outcome: await data.listHistory(timeZone, offset),
        });
        return;
      case "mistakes":
        dispatch({
          type: "more_loaded",
          section,
          offset,
          outcome: await data.listMistakes(offset),
        });
        return;
      case "words":
        dispatch({
          type: "more_loaded",
          section,
          offset,
          outcome: await data.listWords(timeZone, offset),
        });
        return;
      case "notes":
        dispatch({
          type: "more_loaded",
          section,
          offset,
          outcome: await data.listNotes(timeZone, offset),
        });
        return;
    }
  }

  return {
    state,
    section,
    select: setSection,
    retry,
    loadMore: () => readNext("auto"),
    retryMore: () => readNext("retry"),
  };
}
