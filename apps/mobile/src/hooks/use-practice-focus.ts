import type { PracticeTarget } from "@fluency-lab/shared";
import { useIsFocused } from "expo-router";
import { useEffect, useReducer, useState } from "react";

import { data } from "@/data";
import {
  DEFAULT_TARGET,
  defaultFocus,
  focusReducer,
  initialFocus,
  type FocusChoice,
  type FocusState,
} from "@/utils/practice-focus";
import { deviceTimeZone } from "@/utils/time-zone";

function readFocus() {
  return Promise.all([
    data.getProfile(),
    data.listMistakes(0),
    data.listWords(deviceTimeZone(), 0),
  ]);
}

export function usePracticeFocus(): {
  state: FocusState;
  choice: FocusChoice | null;
  target: PracticeTarget;
  select: (choice: FocusChoice) => void;
  setTarget: (target: PracticeTarget) => void;
  retry: () => Promise<void>;
} {
  const [state, dispatch] = useReducer(focusReducer, initialFocus);
  const [picked, setPicked] = useState<FocusChoice | null>(null);
  const [target, setTarget] = useState<PracticeTarget>(DEFAULT_TARGET);
  const focused = useIsFocused();

  // INFO: read on every focus, so the mistakes and words are fresh when Practice opens.
  useEffect(() => {
    if (!focused) return;
    let live = true;
    void readFocus().then(([profile, mistakes, words]) => {
      // INFO: a read that ends after the screen unmounts is dropped.
      if (live) dispatch({ type: "loaded", profile, mistakes, words });
    });
    return () => {
      live = false;
    };
  }, [focused]);

  async function retry(): Promise<void> {
    dispatch({ type: "load_started" });
    const [profile, mistakes, words] = await readFocus();
    dispatch({ type: "loaded", profile, mistakes, words });
  }

  const choice = state.kind === "ready" ? (picked ?? defaultFocus(state.model)) : null;
  return { state, choice, target, select: setPicked, setTarget, retry };
}
