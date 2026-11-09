// apps/mobile/test/utils/onboarding-gate.test.ts
//
// Tests for the onboarding gate: the reducer that follows the profile check,
// the entry the root layout opens and the view the onboarding route draws.
//
// Tested:
// - gateFromProfile for a completed, a pending and a failed read
// - gateReducer: sign in, sign out, retry and stale reads
// - appEntry and onboardingView
//
// What is covered:
// - Normal case, empty case, edges
//
// Run with: pnpm exec jest apps/mobile/test/utils/onboarding-gate.test.ts
//
// SEE: apps/mobile/src/utils/onboarding-gate.ts

import { describe, expect, it } from "@jest/globals";

import {
  appEntry,
  gateFromProfile,
  gateReducer,
  initialGate,
  onboardingView,
  type OnboardingGate,
} from "@/utils/onboarding-gate";
import { profileWith } from "../helpers/fake-data";

const completed = {
  ok: true,
  value: profileWith({ onboardingCompletedAt: "2026-11-05T10:00:00Z" }),
} as const;
const pending = { ok: true, value: profileWith({}) } as const;

describe("gateFromProfile", () => {
  it("is completed when the profile has a completion time", () => {
    expect(gateFromProfile("user-1", completed)).toEqual({ status: "completed", userId: "user-1" });
  });

  it("is pending when the completion time is null", () => {
    expect(gateFromProfile("user-1", pending)).toEqual({ status: "pending", userId: "user-1" });
  });

  it("is pending for a fresh profile with nothing set", () => {
    const fresh = { ok: true, value: profileWith({ level: null, goals: [], topics: [] }) } as const;
    expect(gateFromProfile("user-1", fresh).status).toBe("pending");
  });

  it("is failed with the data failure", () => {
    expect(gateFromProfile("user-1", { ok: false, failure: "network" })).toEqual({
      status: "failed",
      userId: "user-1",
      failure: "network",
    });
  });
});

describe("gateReducer", () => {
  it("starts signed out", () => {
    expect(initialGate).toEqual({ status: "signed_out" });
  });

  it("checks when a user signs in", () => {
    expect(gateReducer(initialGate, { type: "user_changed", userId: "user-1" })).toEqual({
      status: "checking",
      userId: "user-1",
    });
  });

  it("goes back to signed out when the user signs out", () => {
    const gate: OnboardingGate = { status: "completed", userId: "user-1" };
    expect(gateReducer(gate, { type: "user_changed", userId: null })).toEqual({
      status: "signed_out",
    });
  });

  it("applies the profile read of the current user", () => {
    const gate: OnboardingGate = { status: "checking", userId: "user-1" };
    expect(gateReducer(gate, { type: "profile_read", userId: "user-1", outcome: pending })).toEqual(
      {
        status: "pending",
        userId: "user-1",
      },
    );
  });

  it("ignores a profile read for another user", () => {
    const gate: OnboardingGate = { status: "checking", userId: "user-2" };
    expect(gateReducer(gate, { type: "profile_read", userId: "user-1", outcome: completed })).toBe(
      gate,
    );
  });

  it("rechecks a failed gate on retry", () => {
    const gate: OnboardingGate = { status: "failed", userId: "user-1", failure: "unavailable" };
    expect(gateReducer(gate, { type: "check_started", userId: "user-1" })).toEqual({
      status: "checking",
      userId: "user-1",
    });
  });

  it("ignores a retry with no user", () => {
    expect(gateReducer(initialGate, { type: "check_started", userId: "user-1" })).toBe(initialGate);
  });
});

describe("appEntry", () => {
  it("enters Home only when completed for the same user", () => {
    expect(appEntry("user-1", { status: "completed", userId: "user-1" })).toBe("home");
  });

  it("enters onboarding while checking, pending or failed", () => {
    const gates: OnboardingGate[] = [
      { status: "checking", userId: "user-1" },
      { status: "pending", userId: "user-1" },
      { status: "failed", userId: "user-1", failure: "network" },
    ];
    expect(gates.map((gate) => appEntry("user-1", gate))).toEqual([
      "onboarding",
      "onboarding",
      "onboarding",
    ]);
  });

  it("enters onboarding when the gate belongs to another user", () => {
    expect(appEntry("user-2", { status: "completed", userId: "user-1" })).toBe("onboarding");
  });

  it("enters the signed out screens with no user", () => {
    expect(appEntry(null, initialGate)).toBe("signed_out");
  });
});

describe("onboardingView", () => {
  it("draws loading while checking or for another user", () => {
    expect(onboardingView("user-1", { status: "checking", userId: "user-1" })).toEqual({
      kind: "loading",
    });
    expect(onboardingView("user-2", { status: "pending", userId: "user-1" })).toEqual({
      kind: "loading",
    });
    expect(onboardingView("user-1", initialGate)).toEqual({ kind: "loading" });
  });

  it("draws the failure when failed", () => {
    expect(
      onboardingView("user-1", { status: "failed", userId: "user-1", failure: "unauthorized" }),
    ).toEqual({ kind: "failed", failure: "unauthorized" });
  });

  it("draws the steps when pending", () => {
    expect(onboardingView("user-1", { status: "pending", userId: "user-1" })).toEqual({
      kind: "steps",
    });
  });

  it("draws the steps if the profile is already completed, until the guard moves on", () => {
    expect(onboardingView("user-1", { status: "completed", userId: "user-1" })).toEqual({
      kind: "steps",
    });
  });
});

describe("gate Try again", () => {
  const network: OnboardingGate = { status: "failed", userId: "user-1", failure: "network" };

  it("keeps a failed gate on the network as retrying when the check starts again", () => {
    expect(gateReducer(network, { type: "check_started", userId: "user-1" })).toEqual({
      status: "failed",
      userId: "user-1",
      failure: "network",
      retrying: true,
    });
  });

  it("checks again from loading after a failure that is not the network", () => {
    const gate: OnboardingGate = { status: "failed", userId: "user-1", failure: "unauthorized" };
    expect(gateReducer(gate, { type: "check_started", userId: "user-1" })).toEqual({
      status: "checking",
      userId: "user-1",
    });
  });

  it("passes retrying to the onboarding view", () => {
    const retrying = gateReducer(network, { type: "check_started", userId: "user-1" });
    expect(onboardingView("user-1", retrying)).toEqual({
      kind: "failed",
      failure: "network",
      retrying: true,
    });
    expect(onboardingView("user-1", network)).toEqual({ kind: "failed", failure: "network" });
  });

  it("still sends a retrying gate to onboarding", () => {
    const retrying = gateReducer(network, { type: "check_started", userId: "user-1" });
    expect(appEntry("user-1", retrying)).toBe("onboarding");
  });

  it("draws the profile when the retried read succeeds", () => {
    const retrying = gateReducer(network, { type: "check_started", userId: "user-1" });
    expect(
      gateReducer(retrying, { type: "profile_read", userId: "user-1", outcome: completed }),
    ).toEqual({ status: "completed", userId: "user-1" });
  });
});
