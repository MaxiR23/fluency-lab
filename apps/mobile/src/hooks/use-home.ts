import { useIsFocused } from "expo-router";
import { useEffect, useReducer } from "react";

import { data } from "@/data";
import { deviceTimeZone } from "@/utils/time-zone";
import { homeReducer, initialHome, type HomeState } from "@/utils/home-state";

function readHome() {
  return Promise.all([
    data.getProfile(),
    data.getActiveSession(),
    data.getSessionWeek(deviceTimeZone()),
  ]);
}

export function useHome(): { state: HomeState; retry: () => Promise<void> } {
  const [state, dispatch] = useReducer(homeReducer, initialHome);
  const focused = useIsFocused();

  // INFO: read on every focus, so the session and the relative time refresh when Chat goes back here.
  useEffect(() => {
    if (!focused) return;
    let live = true;
    void readHome().then(([profile, active, week]) => {
      // INFO: a read that ends after Home unmounts is dropped.
      if (live) dispatch({ type: "loaded", profile, active, week, loadedAt: Date.now() });
    });
    return () => {
      live = false;
    };
  }, [focused]);

  async function retry(): Promise<void> {
    dispatch({ type: "load_started" });
    const [profile, active, week] = await readHome();
    dispatch({ type: "loaded", profile, active, week, loadedAt: Date.now() });
  }

  return { state, retry };
}
