import { useIsFocused } from "expo-router";
import { useEffect, useReducer } from "react";

import { data } from "@/data";
import { keys } from "@/keys";
import { initialSettings, settingsReducer, type SettingsState } from "@/utils/settings";
import { deviceTimeZone } from "@/utils/time-zone";

function readSettings() {
  return Promise.all([data.getProfile(), data.getMonthSpend(deviceTimeZone()), keys.hasApiKey()]);
}

export function useSettings(): { state: SettingsState; retry: () => Promise<void> } {
  const [state, dispatch] = useReducer(settingsReducer, initialSettings);
  const focused = useIsFocused();

  // INFO: read on every focus, so the spend and the key refresh when an edit screen goes back here.
  useEffect(() => {
    if (!focused) return;
    let live = true;
    void readSettings().then(([profile, spend, key]) => {
      // INFO: a read that ends after Settings unmounts is dropped.
      if (live) dispatch({ type: "loaded", profile, spend, key });
    });
    return () => {
      live = false;
    };
  }, [focused]);

  async function retry(): Promise<void> {
    dispatch({ type: "load_started" });
    const [profile, spend, key] = await readSettings();
    dispatch({ type: "loaded", profile, spend, key });
  }

  return { state, retry };
}
