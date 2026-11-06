// apps/mobile/test/app/(tabs)/index.test.tsx
//
// Tests for Home and the tab bar around it.
//
// Tested:
// - Loading, with data, no active session and error states
// - The greeting, Continue and the suggestions of the profile
// - Free chat, Continue and a suggestion open Chat
// - The tab bar: Home is the current tab and not a link to itself
// - Signed out users cannot reach Home
//
// What is covered:
// - Normal case, empty case, edges
//
// Run with: pnpm exec jest "apps/mobile/test/app/(tabs)/index.test.tsx"
//
// SEE: apps/mobile/src/app/(tabs)/index.tsx

import { suggestTopics } from "@fluency-lab/shared";
import { beforeEach, describe, expect, it, jest } from "@jest/globals";
import { act, fireEvent, screen } from "@testing-library/react-native";
import { router } from "expo-router";

import { dataFailureMessage } from "@/utils/data-message";
import { fakeSession, resetFakeAuth } from "../../helpers/fake-auth";
import { activeSessionWith, fakeData, profileWith, resetFakeData } from "../../helpers/fake-data";
import { resetFakeKeys } from "../../helpers/fake-keys";
import { renderApp } from "../../helpers/render-app";

jest.mock("expo-font", () => ({ useFonts: jest.fn(() => [true, null]) }));
jest.mock("expo-splash-screen", () => ({
  preventAutoHideAsync: jest.fn(),
  hide: jest.fn(),
}));
jest.mock("@/data", () => ({
  data: jest.requireActual<typeof import("../../helpers/fake-data")>("../../helpers/fake-data")
    .fakeData,
}));
jest.mock("@/keys", () => ({
  keys: jest.requireActual<typeof import("../../helpers/fake-keys")>("../../helpers/fake-keys")
    .fakeKeys,
}));
jest.mock("@/auth", () => {
  const fake =
    jest.requireActual<typeof import("../../helpers/fake-auth")>("../../helpers/fake-auth");
  return { auth: fake.fakeAuth, apple: fake.fakeApple };
});

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

const completedAt = "2026-11-05T10:00:00Z";
const maxi = profileWith({
  displayName: "Maxi",
  level: "intermediate",
  goals: ["travel"],
  topics: ["food", "travel", "music"],
  onboardingCompletedAt: completedAt,
});

describe("Home", () => {
  beforeEach(() => {
    resetFakeAuth();
    resetFakeData();
    resetFakeKeys();
  });

  it("draws the loading state while the reads run", async () => {
    const pending = deferred<Awaited<ReturnType<typeof fakeData.getProfile>>>();
    fakeData.getProfile
      .mockResolvedValueOnce({ ok: true, value: maxi })
      .mockReturnValueOnce(pending.promise);
    await renderApp("/", fakeSession());
    expect(screen.getByTestId("home-loading")).toBeTruthy();
    await act(async () => pending.resolve({ ok: true, value: maxi }));
    expect(screen.queryByTestId("home-loading")).toBeNull();
  });

  it("greets by display name and draws Free chat, Continue and the suggestions", async () => {
    fakeData.getProfile.mockResolvedValue({ ok: true, value: maxi });
    fakeData.getActiveSession.mockResolvedValue({
      ok: true,
      value: activeSessionWith(
        { title: "Weekend plans" },
        {
          text: "Where do you want to go?",
          createdAt: new Date(Date.now() - 5 * 60_000).toISOString(),
        },
      ),
    });
    await renderApp("/", fakeSession());
    expect(screen.getByText("Hi, Maxi")).toBeTruthy();
    expect(screen.getByText("What do you want to practice today?")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Free chat" })).toBeTruthy();
    expect(screen.getByText("Continue")).toBeTruthy();
    expect(screen.getByText("Weekend plans")).toBeTruthy();
    expect(screen.getByText("Where do you want to go?")).toBeTruthy();
    expect(screen.getByText("5 min ago")).toBeTruthy();
    expect(screen.getByText("Suggested for you")).toBeTruthy();
    for (const suggestion of suggestTopics(maxi)) {
      expect(screen.getByRole("button", { name: suggestion.title })).toBeTruthy();
    }
  });

  it("says Hi without a display name", async () => {
    await renderApp("/", fakeSession());
    expect(screen.getByText("Hi")).toBeTruthy();
  });

  it("draws no Continue when there is no active session", async () => {
    await renderApp("/", fakeSession());
    expect(screen.queryByText("Continue")).toBeNull();
    expect(screen.queryByText("Weekend plans")).toBeNull();
    expect(screen.getByText("Suggested for you")).toBeTruthy();
  });

  it.each([
    ["music", "books"],
    ["books", "music"],
  ] as const)("draws the suggestions of the %s topic and not those of %s", async (own, other) => {
    const profile = profileWith({ topics: [own], onboardingCompletedAt: completedAt });
    fakeData.getProfile.mockResolvedValue({ ok: true, value: profile });
    await renderApp("/", fakeSession());
    const drawn = suggestTopics(profile);
    expect(drawn.length).toBeGreaterThan(0);
    for (const suggestion of drawn) {
      expect(screen.getByRole("button", { name: suggestion.title })).toBeTruthy();
    }
    const others = suggestTopics(profileWith({ topics: [other] }));
    for (const suggestion of others) {
      expect(screen.queryByRole("button", { name: suggestion.title })).toBeNull();
    }
  });

  it("draws the failure and reads again on Try again", async () => {
    fakeData.getProfile
      .mockResolvedValueOnce({ ok: true, value: maxi })
      .mockResolvedValueOnce({ ok: false, failure: "network" });
    await renderApp("/", fakeSession());
    expect(screen.getByText(dataFailureMessage("network"))).toBeTruthy();
    fakeData.getProfile.mockResolvedValue({ ok: true, value: maxi });
    await fireEvent.press(screen.getByRole("button", { name: "Try again" }));
    expect(screen.getByText("Hi, Maxi")).toBeTruthy();
    expect(screen.queryByText(dataFailureMessage("network"))).toBeNull();
  });

  it("draws the unauthorized message when the profile read is unauthorized", async () => {
    fakeData.getProfile
      .mockResolvedValueOnce({ ok: true, value: maxi })
      .mockResolvedValueOnce({ ok: false, failure: "unauthorized" });
    await renderApp("/", fakeSession());
    expect(screen.getByText(dataFailureMessage("unauthorized"))).toBeTruthy();
  });

  it("draws the generic message when the active session read is unavailable", async () => {
    fakeData.getActiveSession.mockResolvedValue({ ok: false, failure: "unavailable" });
    await renderApp("/", fakeSession());
    expect(screen.getByText(dataFailureMessage("unavailable"))).toBeTruthy();
  });

  it("opens Chat from Free chat", async () => {
    await renderApp("/", fakeSession());
    await fireEvent.press(screen.getByRole("button", { name: "Free chat" }));
    expect(screen).toHavePathname("/chat");
  });

  it("opens Chat from a suggestion", async () => {
    fakeData.getProfile.mockResolvedValue({ ok: true, value: maxi });
    await renderApp("/", fakeSession());
    const [first] = suggestTopics(maxi);
    await fireEvent.press(screen.getByRole("button", { name: first?.title ?? "" }));
    expect(screen).toHavePathname("/chat");
  });

  it("opens Chat from Continue", async () => {
    fakeData.getActiveSession.mockResolvedValue({
      ok: true,
      value: activeSessionWith({ title: "Weekend plans" }),
    });
    await renderApp("/", fakeSession());
    await fireEvent.press(screen.getByRole("button", { name: "Weekend plans" }));
    expect(screen).toHavePathname("/chat");
  });

  it("marks Home as the current tab and stays on Home when it is pressed", async () => {
    await renderApp("/", fakeSession());
    expect(screen.getByTestId("tab-home").props.accessibilityState).toMatchObject({
      selected: true,
    });
    const reads = fakeData.getProfile.mock.calls.length;
    await fireEvent.press(screen.getByTestId("tab-home"));
    expect(screen).toHavePathname("/");
    expect(fakeData.getProfile).toHaveBeenCalledTimes(reads);
  });

  it("opens Progress and Settings from the tab bar", async () => {
    await renderApp("/", fakeSession());
    await fireEvent.press(screen.getByTestId("tab-progress"));
    expect(screen).toHavePathname("/progress");
    expect(screen.getAllByText("Progress").length).toBe(2);
    await fireEvent.press(screen.getByTestId("tab-settings"));
    expect(screen).toHavePathname("/settings");
    expect(screen.getByRole("button", { name: "Sign out" })).toBeTruthy();
  });

  it("lands on Login when signed out at Home", async () => {
    await renderApp("/", null);
    expect(screen).toHavePathname("/sign-in");
    expect(screen.queryByText("Hi")).toBeNull();
  });

  it("does not show Home when pushed there while signed out", async () => {
    await renderApp("/sign-in", null);
    await act(async () => router.push("/"));
    expect(screen).toHavePathname("/sign-in");
    expect(screen.queryByText("Hi")).toBeNull();
  });
});
