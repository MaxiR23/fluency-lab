import type { Profile } from "@fluency-lab/shared";

import type { DataFailure, DataOutcome } from "@/data/data-port";
import { isNetworkFailure } from "@/utils/load-failure";

export type OnboardingGate =
  | { status: "signed_out" }
  | { status: "checking"; userId: string }
  | { status: "pending"; userId: string }
  | { status: "completed"; userId: string }
  | { status: "failed"; userId: string; failure: DataFailure; retrying?: true };

export type GateEvent =
  | { type: "user_changed"; userId: string | null }
  | { type: "check_started"; userId: string }
  | { type: "profile_read"; userId: string; outcome: DataOutcome<Profile> };

export const initialGate: OnboardingGate = { status: "signed_out" };

export function gateFromProfile(userId: string, outcome: DataOutcome<Profile>): OnboardingGate {
  if (!outcome.ok) return { status: "failed", userId, failure: outcome.failure };
  return outcome.value.onboardingCompletedAt === null
    ? { status: "pending", userId }
    : { status: "completed", userId };
}

function isGateOf(gate: OnboardingGate, userId: string): boolean {
  return gate.status !== "signed_out" && gate.userId === userId;
}

export function gateReducer(gate: OnboardingGate, event: GateEvent): OnboardingGate {
  switch (event.type) {
    case "user_changed":
      return event.userId === null
        ? { status: "signed_out" }
        : { status: "checking", userId: event.userId };
    case "check_started":
      if (!isGateOf(gate, event.userId)) return gate;
      // INFO: a gate that failed on the network stays on screen while the check runs again, so the view
      // can draw its retrying state; any other state checks again from loading.
      if (gate.status === "failed" && isNetworkFailure(gate)) return { ...gate, retrying: true };
      return { status: "checking", userId: event.userId };
    case "profile_read":
      // INFO: a read that finishes after the user changed must not touch the new gate.
      return isGateOf(gate, event.userId) ? gateFromProfile(event.userId, event.outcome) : gate;
  }
}

export function appEntry(
  userId: string | null,
  gate: OnboardingGate,
): "signed_out" | "onboarding" | "home" {
  if (userId === null) return "signed_out";
  return gate.status === "completed" && gate.userId === userId ? "home" : "onboarding";
}

export type OnboardingView =
  | { kind: "loading" }
  | { kind: "failed"; failure: DataFailure; retrying?: true }
  | { kind: "steps" };

export function onboardingView(userId: string | null, gate: OnboardingGate): OnboardingView {
  if (gate.status === "signed_out" || gate.userId !== userId) return { kind: "loading" };
  switch (gate.status) {
    case "checking":
      return { kind: "loading" };
    case "failed":
      return gate.retrying === true
        ? { kind: "failed", failure: gate.failure, retrying: true }
        : { kind: "failed", failure: gate.failure };
    case "pending":
    case "completed":
      return { kind: "steps" };
  }
}
