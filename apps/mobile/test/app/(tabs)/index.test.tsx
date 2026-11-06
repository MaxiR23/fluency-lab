// apps/mobile/test/app/(tabs)/index.test.tsx
//
// Tests for Home and the tab bar around it.
//
// Tested:
// - Loading, with data, expected empty (no Continue, empty week) and error states
// - The greeting, the avatar, the week, Free chat, Continue and the suggestions
// - Free chat, Continue and a suggestion open Chat, and See all opens the list
// - See all (N) next to Continue with more than one open session, opening Open chats
// - The tab bar: Home is the current tab and not a link or a button
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
import { act, fireEvent, screen, within } from "@testing-library/react-native";
import { router } from "expo-router";

import { dataFailureMessage } from "@/utils/data-message";
import { greeting } from "@/utils/home";
import { fakeSession, resetFakeAuth } from "../../helpers/fake-auth";
import {
  activeSessionWith,
  fakeData,
  profileWith,
  resetFakeData,
  weekWith,
} from "../../helpers/fake-data";
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

  it("draws the greeting, the avatar, the week, Free chat, Continue and the suggestions", async () => {
    fakeData.getProfile.mockResolvedValue({ ok: true, value: maxi });
    fakeData.getSessionWeek.mockResolvedValue({
      ok: true,
      value: weekWith(["2026-11-02", "2026-11-04", "2026-11-05"]),
    });
    fakeData.listOpenSessions.mockResolvedValue({
      ok: true,
      value: [
        activeSessionWith(
          { topicId: "job_interviews", title: "Weekend plans" },
          { createdAt: new Date(Date.now() - 24 * 60 * 60_000).toISOString() },
        ),
      ],
    });
    await renderApp("/", fakeSession());
    expect(screen.getByText(greeting("Maxi", new Date()))).toBeTruthy();
    expect(screen.getByText("Ready to practice?")).toBeTruthy();
    expect(
      within(screen.getByTestId("avatar", { includeHiddenElements: true })).getByText("M", {
        includeHiddenElements: true,
      }),
    ).toBeTruthy();
    expect(screen.getByText("This week")).toBeTruthy();
    expect(screen.getByText("3 of 7 days")).toBeTruthy();
    expect(screen.getByLabelText("Monday, practiced")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Free chat" })).toBeTruthy();
    expect(screen.getByText("Talk about anything. Get corrections as you go.")).toBeTruthy();
    expect(screen.getByText("Continue")).toBeTruthy();
    expect(screen.getByText("Weekend plans")).toBeTruthy();
    expect(screen.getByText("Job interviews · yesterday")).toBeTruthy();
    expect(screen.getByText("Resume")).toBeTruthy();
    expect(screen.getByText("Suggested for you")).toBeTruthy();
    expect(screen.getByRole("link", { name: "See all" })).toBeTruthy();
    for (const suggestion of suggestTopics(maxi)) {
      expect(screen.getByRole("button", { name: suggestion.title })).toBeTruthy();
      expect(screen.getAllByText(suggestion.tag).length).toBeGreaterThan(0);
      expect(screen.getAllByText(suggestion.why).length).toBeGreaterThan(0);
    }
  });

  it("draws the person icon and no name without a display name", async () => {
    await renderApp("/", fakeSession());
    expect(screen.getByText(greeting(null, new Date()))).toBeTruthy();
    expect(screen.getByTestId("icon-person", { includeHiddenElements: true })).toBeTruthy();
  });

  it("draws the expected empty state: no Continue and an empty week", async () => {
    await renderApp("/", fakeSession());
    expect(screen.getByText("0 of 7 days")).toBeTruthy();
    expect(screen.queryByText("Continue")).toBeNull();
    expect(screen.getByText("Suggested for you")).toBeTruthy();
  });

  it.each(["music", "books"] as const)(
    "draws the %s topic as an interest and the rest as new topics",
    async (own) => {
      const profile = profileWith({
        topics: [own],
        level: "intermediate",
        onboardingCompletedAt: completedAt,
      });
      fakeData.getProfile.mockResolvedValue({ ok: true, value: profile });
      await renderApp("/", fakeSession());
      const drawn = suggestTopics(profile);
      expect(drawn.length).toBeGreaterThan(0);
      for (const suggestion of drawn) {
        expect(screen.getByRole("button", { name: suggestion.title })).toBeTruthy();
      }
      expect(drawn[0]).toMatchObject({ topicId: own, tag: "Your interests" });
      for (const suggestion of drawn.filter((entry) => entry.topicId !== own)) {
        expect(suggestion.tag).toBe("New topic");
      }
    },
  );

  it("draws the failure and reads again on Try again", async () => {
    fakeData.getProfile
      .mockResolvedValueOnce({ ok: true, value: maxi })
      .mockResolvedValueOnce({ ok: false, failure: "network" });
    await renderApp("/", fakeSession());
    expect(screen.getByText(dataFailureMessage("network"))).toBeTruthy();
    fakeData.getProfile.mockResolvedValue({ ok: true, value: maxi });
    await fireEvent.press(screen.getByRole("button", { name: "Try again" }));
    expect(screen.getByText("Ready to practice?")).toBeTruthy();
    expect(screen.queryByText(dataFailureMessage("network"))).toBeNull();
  });

  it("draws the unauthorized message when the profile read is unauthorized", async () => {
    fakeData.getProfile
      .mockResolvedValueOnce({ ok: true, value: maxi })
      .mockResolvedValueOnce({ ok: false, failure: "unauthorized" });
    await renderApp("/", fakeSession());
    expect(screen.getByText(dataFailureMessage("unauthorized"))).toBeTruthy();
  });

  it("draws the generic message when the open sessions read is unavailable", async () => {
    fakeData.listOpenSessions.mockResolvedValue({ ok: false, failure: "unavailable" });
    await renderApp("/", fakeSession());
    expect(screen.getByText(dataFailureMessage("unavailable"))).toBeTruthy();
  });

  it("draws the failure when the week read fails", async () => {
    fakeData.getSessionWeek.mockResolvedValue({ ok: false, failure: "unavailable" });
    await renderApp("/", fakeSession());
    expect(screen.getByText(dataFailureMessage("unavailable"))).toBeTruthy();
    expect(screen.queryByText("This week")).toBeNull();
  });

  it("opens Chat from Free chat", async () => {
    await renderApp("/", fakeSession());
    await fireEvent.press(screen.getByRole("button", { name: "Free chat" }));
    expect(screen).toHavePathname("/chat");
    expect(screen).toHaveSearchParams({});
  });

  it("opens Chat from a suggestion", async () => {
    fakeData.getProfile.mockResolvedValue({ ok: true, value: maxi });
    await renderApp("/", fakeSession());
    const [first] = suggestTopics(maxi);
    await fireEvent.press(screen.getByRole("button", { name: first?.title ?? "" }));
    expect(screen).toHavePathname("/chat");
    expect(screen).toHaveSearchParams({ starter: first?.id ?? "" });
  });

  it("opens Chat from Continue", async () => {
    fakeData.listOpenSessions.mockResolvedValue({
      ok: true,
      value: [activeSessionWith({ title: "Weekend plans" })],
    });
    await renderApp("/", fakeSession());
    await fireEvent.press(screen.getByRole("button", { name: "Weekend plans" }));
    expect(screen).toHavePathname("/chat");
    expect(screen).toHaveSearchParams({ session: "session-1" });
  });

  it("shows no See all next to Continue with one open session", async () => {
    fakeData.listOpenSessions.mockResolvedValue({
      ok: true,
      value: [activeSessionWith({ title: "Weekend plans" })],
    });
    await renderApp("/", fakeSession());
    expect(screen.getByText("Continue")).toBeTruthy();
    expect(screen.queryByRole("link", { name: /See all \(/ })).toBeNull();
  });

  it("shows See all (2) next to Continue with two open sessions and Continue is the newest", async () => {
    fakeData.listOpenSessions.mockResolvedValue({
      ok: true,
      value: [
        activeSessionWith({ id: "session-2", title: "Newest chat" }),
        activeSessionWith({ id: "session-1", title: "Older chat" }),
      ],
    });
    await renderApp("/", fakeSession());
    expect(screen.getByRole("link", { name: "See all (2)" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Newest chat" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Older chat" })).toBeNull();
  });

  it("opens Open chats from See all (N)", async () => {
    fakeData.listOpenSessions.mockResolvedValue({
      ok: true,
      value: [activeSessionWith({ id: "session-2" }), activeSessionWith({ id: "session-1" })],
    });
    await renderApp("/", fakeSession());
    await fireEvent.press(screen.getByRole("link", { name: "See all (2)" }));
    expect(screen).toHavePathname("/chats");
  });

  it("opens the list of every suggestion from See all", async () => {
    await renderApp("/", fakeSession());
    await fireEvent.press(screen.getByRole("link", { name: "See all" }));
    expect(screen).toHavePathname("/suggestions");
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

  it("draws Home as the current tab, not as a link or a button", async () => {
    await renderApp("/", fakeSession());
    expect(screen.queryByRole("link", { name: "Home" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Home" })).toBeNull();
    expect(screen.getByRole("tab", { name: "Home" })).toBeTruthy();
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
    expect(screen.queryByText("Ready to practice?")).toBeNull();
  });

  it("does not show Home when pushed there while signed out", async () => {
    await renderApp("/sign-in", null);
    await act(async () => router.push("/"));
    expect(screen).toHavePathname("/sign-in");
    expect(screen.queryByText("Ready to practice?")).toBeNull();
  });
});
