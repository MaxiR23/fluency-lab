import type { FailureCause } from "@/auth/auth-port";

// INFO: a tab press and the Send button are the two moments that play feedback.
export type HapticKind = "tab" | "send";

// INFO: there is no expected empty case: playing returns no data. A missed buzz has nothing to
// draw, so callers ignore the failure.
export type HapticsOutcome =
  { ok: true; value: null } | { ok: false; failure: "not_played"; cause?: FailureCause };

export type HapticsReadOutcome =
  { ok: true; value: boolean } | { ok: false; failure: "not_read"; cause?: FailureCause };

export type HapticsSaveOutcome =
  { ok: true; value: null } | { ok: false; failure: "not_saved"; cause?: FailureCause };

export type HapticsPort = {
  play(kind: HapticKind): Promise<HapticsOutcome>;
};

// INFO: the on/off setting stored on the device. A missing item reads as on, the default.
export type HapticsSettingPort = {
  read(): Promise<HapticsReadOutcome>;
  save(on: boolean): Promise<HapticsSaveOutcome>;
};
