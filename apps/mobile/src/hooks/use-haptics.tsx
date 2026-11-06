import { createContext, type ReactNode, use, useEffect, useReducer } from "react";

import { haptics, hapticsSetting } from "@/haptics";
import type { HapticKind, HapticsSaveOutcome } from "@/haptics/haptics-port";
import {
  hapticsSettingReducer,
  initialHapticsSetting,
  shouldPlay,
  type HapticsSettingState,
} from "@/utils/haptics-setting";

type HapticsValue = {
  setting: HapticsSettingState;
  play: (kind: HapticKind) => void;
  setEnabled: (on: boolean) => Promise<HapticsSaveOutcome>;
};

const HapticsContext = createContext<HapticsValue | null>(null);

export function HapticsProvider({ children }: { children: ReactNode }) {
  const [setting, dispatch] = useReducer(hapticsSettingReducer, initialHapticsSetting);

  // INFO: the stored setting is read once, when the app starts.
  useEffect(() => {
    let live = true;
    void hapticsSetting.read().then((outcome) => {
      if (live) dispatch({ type: "read", outcome });
    });
    return () => {
      live = false;
    };
  }, []);

  function play(kind: HapticKind): void {
    if (!shouldPlay(setting)) return;
    // INFO: a failed buzz has nothing to draw, so the outcome is ignored.
    void haptics.play(kind);
  }

  async function setEnabled(on: boolean): Promise<HapticsSaveOutcome> {
    const outcome = await hapticsSetting.save(on);
    dispatch(outcome.ok ? { type: "saved", on } : { type: "save_failed" });
    return outcome;
  }

  return <HapticsContext value={{ setting, play, setEnabled }}>{children}</HapticsContext>;
}

// INFO: using the hook outside the provider is a programming error, not an outcome.
export function useHaptics(): HapticsValue {
  const value = use(HapticsContext);
  if (value === null) {
    throw new Error("useHaptics must be used inside HapticsProvider");
  }
  return value;
}
