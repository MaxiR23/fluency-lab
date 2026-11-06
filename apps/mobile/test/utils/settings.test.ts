// apps/mobile/test/utils/settings.test.ts
//
// Tests for the Settings pure functions.
//
// Tested:
// - formatUsd, resetLine, spendFraction, barWidth, limitLine
// - providerLabel, modelLabel, keyLabel
// - settingsFromReads and settingsReducer
// - keyStepParams, the route params of the key step opened from Settings
//
// What is covered:
// - Normal case, empty case, edges
//
// Run with: pnpm exec jest apps/mobile/test/utils/settings.test.ts
//
// SEE: apps/mobile/src/utils/settings.ts

import { describe, expect, it } from "@jest/globals";

import { keyReadFailureMessage } from "@/utils/data-message";
import {
  barWidth,
  formatUsd,
  initialSettings,
  keyLabel,
  keyStepParams,
  limitLine,
  modelLabel,
  providerLabel,
  resetLine,
  settingsFromReads,
  settingsReducer,
  spendFraction,
} from "@/utils/settings";
import { completedProfile, profileWith } from "../helpers/fake-data";

describe("formatUsd", () => {
  it("formats 0.42 as $0.42 and 10 as $10.00", () => {
    expect(formatUsd(0.42)).toBe("$0.42");
    expect(formatUsd(10)).toBe("$10.00");
  });

  it("formats 0 as $0.00", () => {
    expect(formatUsd(0)).toBe("$0.00");
  });

  it("rounds 0.004 to $0.00 and 0.005 to $0.01", () => {
    expect(formatUsd(0.004)).toBe("$0.00");
    expect(formatUsd(0.005)).toBe("$0.01");
  });
});

describe("resetLine", () => {
  it("says resets on Dec 1 for a November month", () => {
    expect(resetLine("2026-11-01")).toBe("Counted by Fluency Lab · resets on Dec 1");
  });

  it("rolls December over to Jan 1", () => {
    expect(resetLine("2026-12-01")).toBe("Counted by Fluency Lab · resets on Jan 1");
  });

  it("says Feb 1 for January", () => {
    expect(resetLine("2026-01-01")).toBe("Counted by Fluency Lab · resets on Feb 1");
  });
});

describe("spendFraction", () => {
  it("is the share of the limit", () => {
    expect(spendFraction(2.5, 10)).toBe(0.25);
  });

  it("is 0 for no spend", () => {
    expect(spendFraction(0, 10)).toBe(0);
  });

  it("is 1 at the limit and stays 1 over it", () => {
    expect(spendFraction(10, 10)).toBe(1);
    expect(spendFraction(10.01, 10)).toBe(1);
  });

  it("is null without a limit", () => {
    expect(spendFraction(3, null)).toBeNull();
  });
});

describe("barWidth", () => {
  it("is the fraction as a percentage rounded to two decimals", () => {
    expect(barWidth(0.042)).toBe("4.2%");
    expect(barWidth(0.42 / 10)).toBe("4.2%");
    expect(barWidth(1 / 3)).toBe("33.33%");
  });

  it("is 0% at no spend and 100% at the limit", () => {
    expect(barWidth(0)).toBe("0%");
    expect(barWidth(1)).toBe("100%");
  });
});

describe("limitLine", () => {
  it("says of the limit in dollars", () => {
    expect(limitLine(10)).toBe("of $10.00");
    expect(limitLine(25.5)).toBe("of $25.50");
  });

  it("says No limit set for a null limit", () => {
    expect(limitLine(null)).toBe("No limit set");
  });
});

describe("providerLabel, modelLabel and keyLabel", () => {
  it("names the providers and Not set for none", () => {
    expect(providerLabel("claude")).toBe("Claude");
    expect(providerLabel("openai")).toBe("OpenAI");
    expect(providerLabel(null)).toBe("Not set");
  });

  it("names claude-haiku-5-5 Claude Haiku 5.5", () => {
    expect(modelLabel("claude-haiku-5-5")).toBe("Claude Haiku 5.5");
  });

  it("says whether the key is saved", () => {
    expect(keyLabel(true)).toBe("Saved on this device");
    expect(keyLabel(false)).toBe("Not set");
  });
});

describe("settingsFromReads", () => {
  const profile = profileWith({ provider: "claude", monthlyLimitUsd: 10 });
  const spend = { monthStart: "2026-11-01", spentUsd: 0.42 };

  it("is ready with the three reads", () => {
    expect(
      settingsFromReads(
        { ok: true, value: profile },
        { ok: true, value: spend },
        { ok: true, value: true },
      ),
    ).toEqual({ kind: "ready", profile, spend, hasKey: true });
  });

  it("is ready with zero spend and no key", () => {
    const none = { monthStart: "2026-11-01", spentUsd: 0 };
    expect(
      settingsFromReads(
        { ok: true, value: completedProfile() },
        { ok: true, value: none },
        { ok: true, value: false },
      ),
    ).toMatchObject({ kind: "ready", spend: none, hasKey: false });
  });

  it("fails with the profile failure first", () => {
    const state = settingsFromReads(
      { ok: false, failure: "unauthorized" },
      { ok: false, failure: "network" },
      { ok: true, value: true },
    );
    expect(state).toEqual({ kind: "failed", message: "Your session ended. Sign in again." });
  });

  it("fails with the spend failure", () => {
    expect(
      settingsFromReads(
        { ok: true, value: profile },
        { ok: false, failure: "network" },
        { ok: true, value: true },
      ),
    ).toEqual({
      kind: "failed",
      message: "Could not reach the server. Check your connection and try again.",
    });
  });

  it("fails with the key read message and its cause", () => {
    const cause = { name: "Error", detail: "denied" };
    expect(
      settingsFromReads(
        { ok: true, value: profile },
        { ok: true, value: spend },
        { ok: false, failure: "not_read", cause },
      ),
    ).toEqual({ kind: "failed", message: keyReadFailureMessage, cause });
  });
});

describe("settingsReducer", () => {
  it("load_started goes back to loading", () => {
    const ready = settingsFromReads(
      { ok: true, value: completedProfile() },
      { ok: true, value: { monthStart: "2026-11-01", spentUsd: 0 } },
      { ok: true, value: false },
    );
    expect(settingsReducer(ready, { type: "load_started" })).toEqual(initialSettings);
    expect(initialSettings).toEqual({ kind: "loading" });
  });

  it("loaded builds the state from the reads", () => {
    const state = settingsReducer(initialSettings, {
      type: "loaded",
      profile: { ok: false, failure: "unavailable" },
      spend: { ok: false, failure: "unavailable" },
      key: { ok: true, value: false },
    });
    expect(state.kind).toBe("failed");
  });
});

describe("keyStepParams", () => {
  it("passes the provider, the limit and removable 1", () => {
    const profile = profileWith({ provider: "openai", monthlyLimitUsd: 25.5 });
    expect(keyStepParams(profile, true)).toEqual({
      provider: "openai",
      limit: "25.5",
      removable: "1",
    });
  });

  it("omits the limit when null and passes removable 0", () => {
    expect(keyStepParams(profileWith({ provider: "claude" }), false)).toEqual({
      provider: "claude",
      removable: "0",
    });
  });

  it("falls back to claude without a provider", () => {
    expect(keyStepParams(profileWith({}), false).provider).toBe("claude");
  });
});
