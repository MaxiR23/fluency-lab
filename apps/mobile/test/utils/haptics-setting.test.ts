// apps/mobile/test/utils/haptics-setting.test.ts
//
// Tests for the haptics setting pure functions.
//
// Tested:
// - parseHapticsSetting reads the stored text
// - hapticsSettingReducer, shouldPlay, hapticsSwitchOn and hapticsFailureMessage
//
// What is covered:
// - Normal case, empty case, edges
//
// Run with: pnpm exec jest apps/mobile/test/utils/haptics-setting.test.ts
//
// SEE: apps/mobile/src/utils/haptics-setting.ts

import { describe, expect, it } from "@jest/globals";

import {
  hapticsFailureMessage,
  hapticsSettingReducer,
  hapticsSwitchOn,
  initialHapticsSetting,
  parseHapticsSetting,
  shouldPlay,
  type HapticsSettingState,
} from "@/utils/haptics-setting";

const on: HapticsSettingState = { kind: "ready", on: true, saveFailed: false };
const off: HapticsSettingState = { kind: "ready", on: false, saveFailed: false };

describe("parseHapticsSetting", () => {
  it("reads off as false and on as true", () => {
    expect(parseHapticsSetting("off")).toBe(false);
    expect(parseHapticsSetting("on")).toBe(true);
  });

  it("is on when nothing is stored", () => {
    expect(parseHapticsSetting(null)).toBe(true);
  });

  it("is on for an unknown value", () => {
    expect(parseHapticsSetting("")).toBe(true);
    expect(parseHapticsSetting("maybe")).toBe(true);
  });
});

describe("hapticsSettingReducer", () => {
  it("starts loading", () => {
    expect(initialHapticsSetting).toEqual({ kind: "loading" });
  });

  it("is ready with the stored value after a read", () => {
    expect(
      hapticsSettingReducer(initialHapticsSetting, {
        type: "read",
        outcome: { ok: true, value: false },
      }),
    ).toEqual(off);
  });

  it("fails after a failed read", () => {
    expect(
      hapticsSettingReducer(initialHapticsSetting, {
        type: "read",
        outcome: { ok: false, failure: "not_read" },
      }),
    ).toEqual({ kind: "failed" });
  });

  it("takes the saved value and clears an earlier save failure", () => {
    const failed = hapticsSettingReducer(on, { type: "save_failed" });
    expect(failed).toEqual({ kind: "ready", on: true, saveFailed: true });
    expect(hapticsSettingReducer(failed, { type: "saved", on: false })).toEqual(off);
  });

  it("keeps the previous value after a failed save", () => {
    expect(hapticsSettingReducer(off, { type: "save_failed" })).toEqual({
      kind: "ready",
      on: false,
      saveFailed: true,
    });
  });

  it("leaves a loading or failed setting alone on a failed save", () => {
    expect(hapticsSettingReducer(initialHapticsSetting, { type: "save_failed" })).toEqual(
      initialHapticsSetting,
    );
    expect(hapticsSettingReducer({ kind: "failed" }, { type: "save_failed" })).toEqual({
      kind: "failed",
    });
  });
});

describe("shouldPlay", () => {
  it("plays only when read and on", () => {
    expect(shouldPlay(on)).toBe(true);
    expect(shouldPlay(off)).toBe(false);
  });

  it("does not play while loading or after a failed read", () => {
    expect(shouldPlay(initialHapticsSetting)).toBe(false);
    expect(shouldPlay({ kind: "failed" })).toBe(false);
  });

  it("keeps playing when a save to off failed", () => {
    expect(shouldPlay(hapticsSettingReducer(on, { type: "save_failed" }))).toBe(true);
  });
});

describe("hapticsSwitchOn", () => {
  it("shows the stored value, on while loading and off after a failed read", () => {
    expect(hapticsSwitchOn(on)).toBe(true);
    expect(hapticsSwitchOn(off)).toBe(false);
    expect(hapticsSwitchOn(initialHapticsSetting)).toBe(true);
    expect(hapticsSwitchOn({ kind: "failed" })).toBe(false);
  });
});

describe("hapticsFailureMessage", () => {
  it("has no message when loading or ready", () => {
    expect(hapticsFailureMessage(initialHapticsSetting)).toBeNull();
    expect(hapticsFailureMessage(on)).toBeNull();
  });

  it("says the setting could not be read, with haptics off", () => {
    expect(hapticsFailureMessage({ kind: "failed" })).toBe(
      "Could not read the haptics setting on this device. Haptics are off.",
    );
  });

  it("says the setting could not be saved after a failed save", () => {
    expect(hapticsFailureMessage({ kind: "ready", on: true, saveFailed: true })).toBe(
      "Could not save the haptics setting on this device. Try again.",
    );
  });
});
