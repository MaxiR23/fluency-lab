import type { HapticsReadOutcome } from "@/haptics/haptics-port";

// INFO: a missing or unknown stored value is on, the default.
export function parseHapticsSetting(raw: string | null): boolean {
  return raw !== "off";
}

export type HapticsSettingState =
  { kind: "loading" } | { kind: "failed" } | { kind: "ready"; on: boolean; saveFailed: boolean };

export type HapticsSettingEvent =
  | { type: "read"; outcome: HapticsReadOutcome }
  | { type: "saved"; on: boolean }
  | { type: "save_failed" };

export const initialHapticsSetting: HapticsSettingState = { kind: "loading" };

export function hapticsSettingReducer(
  state: HapticsSettingState,
  event: HapticsSettingEvent,
): HapticsSettingState {
  switch (event.type) {
    case "read":
      return event.outcome.ok
        ? { kind: "ready", on: event.outcome.value, saveFailed: false }
        : { kind: "failed" };
    case "saved":
      return { kind: "ready", on: event.on, saveFailed: false };
    case "save_failed":
      // INFO: a failed save keeps the previous value.
      return state.kind === "ready" ? { ...state, saveFailed: true } : state;
  }
}

// INFO: nothing plays while the setting loads or when it could not be read.
export function shouldPlay(state: HapticsSettingState): boolean {
  return state.kind === "ready" && state.on;
}

export function hapticsSwitchOn(state: HapticsSettingState): boolean {
  if (state.kind === "failed") return false;
  return state.kind === "loading" ? true : state.on;
}

// INFO: the line Settings draws under the App group when the setting could not be read or saved.
export function hapticsFailureMessage(state: HapticsSettingState): string | null {
  if (state.kind === "failed") {
    return "Could not read the haptics setting on this device. Haptics are off.";
  }
  if (state.kind === "ready" && state.saveFailed) {
    return "Could not save the haptics setting on this device. Try again.";
  }
  return null;
}
