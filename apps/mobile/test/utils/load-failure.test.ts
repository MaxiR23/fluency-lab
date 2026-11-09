// apps/mobile/test/utils/load-failure.test.ts
//
// Tests for the can't-connect decision: which view a load failure draws, its title, and
// what Try again keeps on screen while it runs.
//
// Tested:
// - loadFailureView picks the full screen for launch and onboarding, the inline card with
//   its "<thing>" for the other screens, and the message for any other failure
// - retryStarted keeps a network failure on screen as retrying and sends any other state
//   back to loading
// - isNetworkFailure reads a data or auth failure and the message views' flag
//
// What is covered:
// - Normal case, empty case, edges
//
// Run with: pnpm exec jest apps/mobile/test/utils/load-failure.test.ts
//
// SEE: apps/mobile/src/utils/load-failure.ts

import { describe, expect, it } from "@jest/globals";

import {
  dataFailedView,
  isNetworkFailure,
  loadFailureView,
  offlineCardBody,
  offlineScreenBody,
  offlineScreenTitle,
  retryingLabel,
  retryStarted,
  type CardScreen,
  type FailureScreen,
} from "@/utils/load-failure";

const cards: [CardScreen, string][] = [
  ["chats", "your chats"],
  ["note", "this note"],
  ["suggestions", "your suggestions"],
  ["practice", "your practice"],
  ["profile", "your profile"],
  ["edit-profile", "your profile"],
  ["summary", "this summary"],
  ["home", "Home"],
  ["progress", "your progress"],
  ["settings", "your settings"],
  ["chat", "this chat"],
  ["thread", "this thread"],
  ["practice-run", "this practice"],
];

const everyScreen: FailureScreen[] = ["launch", "onboarding", ...cards.map(([screen]) => screen)];

describe("copy", () => {
  it("holds the words of the designs", () => {
    expect(offlineScreenTitle).toBe("Can't connect right now");
    expect(offlineScreenBody).toBe(
      "Check your internet and try again. Your chats and progress are safe.",
    );
    expect(offlineCardBody).toBe("Check your internet and try again.");
    expect(retryingLabel).toBe("Trying again…");
  });
});

describe("loadFailureView", () => {
  it("shows the full screen at launch when the restore fails on the network", () => {
    expect(loadFailureView("launch", { failure: "network", retrying: false })).toEqual({
      kind: "offline_screen",
      retrying: false,
    });
  });

  it("shows the full screen in onboarding when the profile read fails on the network", () => {
    expect(loadFailureView("onboarding", { failure: "network" })).toEqual({
      kind: "offline_screen",
      retrying: false,
    });
  });

  it("passes retrying to the full screen while Try again runs", () => {
    expect(loadFailureView("launch", { failure: "network", retrying: true })).toEqual({
      kind: "offline_screen",
      retrying: true,
    });
  });

  it.each(cards)("titles the card of %s Can't load %s", (screen, thing) => {
    expect(loadFailureView(screen, { failure: "network" })).toEqual({
      kind: "offline_card",
      title: `Can't load ${thing}`,
      retrying: false,
    });
  });

  it("passes retrying to the card while Try again runs", () => {
    expect(loadFailureView("chats", { failure: "network", retrying: true })).toEqual({
      kind: "offline_card",
      title: "Can't load your chats",
      retrying: true,
    });
  });

  it("keeps the message for a failure that is not the network, on every screen", () => {
    for (const screen of everyScreen) {
      for (const failure of [
        "unavailable",
        "unauthorized",
        "not_found",
        "invalid_input",
        "bad_response",
      ]) {
        expect(loadFailureView(screen, { failure })).toEqual({ kind: "message" });
      }
    }
    expect(loadFailureView("launch", { failure: "unknown", retrying: false })).toEqual({
      kind: "message",
    });
  });

  it("keeps the message for a message view without the network flag", () => {
    for (const screen of everyScreen) {
      expect(loadFailureView(screen, {})).toEqual({ kind: "message" });
    }
  });

  it("reads the network flag of a message view", () => {
    expect(loadFailureView("settings", { network: true })).toEqual({
      kind: "offline_card",
      title: "Can't load your settings",
      retrying: false,
    });
  });
});

describe("isNetworkFailure", () => {
  it("reads a data or auth failure and the flag", () => {
    expect(isNetworkFailure({ failure: "network" })).toBe(true);
    expect(isNetworkFailure({ network: true })).toBe(true);
    expect(isNetworkFailure({ failure: "unavailable" })).toBe(false);
    expect(isNetworkFailure({})).toBe(false);
  });
});

describe("dataFailedView", () => {
  it("flags a data read that failed on the network", () => {
    expect(dataFailedView("network")).toEqual({
      kind: "failed",
      message: "Could not reach the server. Check your connection and try again.",
      network: true,
    });
  });

  it("does not flag any other failure", () => {
    const view = dataFailedView("unavailable");
    expect(view.kind).toBe("failed");
    expect(view).not.toHaveProperty("network");
  });
});

type View =
  { kind: "loading" } | { kind: "failed"; failure: string; retrying?: true } | { kind: "ready" };
const loading: View = { kind: "loading" };

function failedWith(failure: string): View {
  return { kind: "failed", failure };
}

describe("retryStarted", () => {
  it("keeps a network failure on screen as retrying when Try again starts", () => {
    const failed = failedWith("network");
    expect(retryStarted<View>(failed, loading)).toEqual({
      kind: "failed",
      failure: "network",
      retrying: true,
    });
  });

  it("goes back to loading when Try again starts after any other failure", () => {
    const failed = failedWith("unavailable");
    expect(retryStarted<View>(failed, loading)).toBe(loading);
  });

  it("goes back to loading from a state that is not failed", () => {
    expect(retryStarted<View>({ kind: "ready" }, loading)).toBe(loading);
    expect(retryStarted<View>(loading, loading)).toBe(loading);
  });

  it("stays retrying when Try again starts twice", () => {
    const failed = failedWith("network");
    expect(retryStarted(retryStarted<View>(failed, loading), loading)).toEqual({
      kind: "failed",
      failure: "network",
      retrying: true,
    });
  });
});
