import { useEffect, useReducer } from "react";

import { data } from "@/data";
import { initialSummary, summaryReducer, type SummaryState } from "@/utils/summary";

function readSummary(sessionId: string) {
  return Promise.all([data.getProfile(), data.getSessionSummary(sessionId)]);
}

export function useSummary(sessionId: string | null): {
  state: SummaryState;
  retry: () => Promise<void>;
} {
  const [state, dispatch] = useReducer(summaryReducer, sessionId, initialSummary);

  // INFO: read once: an ended session's summary does not change while the screen is away.
  useEffect(() => {
    if (sessionId === null) return;
    let live = true;
    void readSummary(sessionId).then(([profile, summary]) => {
      // INFO: a read that ends after Summary unmounts is dropped.
      if (live) dispatch({ type: "loaded", profile, summary });
    });
    return () => {
      live = false;
    };
  }, [sessionId]);

  async function retry(): Promise<void> {
    if (sessionId === null) return;
    dispatch({ type: "load_started" });
    const [profile, summary] = await readSummary(sessionId);
    dispatch({ type: "loaded", profile, summary });
  }

  return { state, retry };
}
