// apps/mobile/test/app/(tabs)/index.test.tsx
//
// Tests for Home and the tab bar around it.
//
// Tested:
// - Loading, with data, expected empty (no Continue, empty week) and error states
// - The greeting, the avatar (a Profile button), today's practice card, the week, the Free chat and Pick a topic tiles and Continue
// - Today's card: a run today (unfinished or finished), and the start state with no run
// - The card opens the run or the focus screen; Free chat opens the suggestions; Pick a topic opens Practice; Continue opens Chat
// - There is no Suggested for you carousel
// - See all (N) next to Continue with more than one open session, opening Open chats
// - The end of Home is padded by the tab bar clearance
// - The tab bar: Home is the current tab and not a link or a button
// - A tab press plays the tab haptic, and nothing plays when the stored setting is off
// - Signed out users cannot reach Home
//
// What is covered:
// - Normal case, empty case, edges
//
// Run with: pnpm exec jest "apps/mobile/test/app/(tabs)/index.test.tsx"
//
// SEE: apps/mobile/src/app/(tabs)/index.tsx

import { beforeEach, describe, expect, it, jest } from "@jest/globals";
import { act, fireEvent, screen, within } from "@testing-library/react-native";
import { router } from "expo-router";
import { StyleSheet } from "react-native";

import { dataFailureMessage } from "@/utils/data-message";
import { greeting } from "@/utils/home";
import { tabBarLayout } from "@/utils/tab-bar";
import { fakeSession, resetFakeAuth } from "../../helpers/fake-auth";
import {
  activeSessionWith,
  fakeData,
  mistakeGroupWith,
  practiceItemWith,
  practiceTodayWith,
  profileWith,
  resetFakeData,
  weekWith,
} from "../../helpers/fake-data";
import { fakeHaptics, fakeHapticsSetting } from "../../helpers/fake-haptics";
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

  it("draws the greeting, the avatar, today's card, the week, the tiles and Continue", async () => {
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
    expect(screen.getByText("Today's practice")).toBeTruthy();
    expect(screen.getByText("This week")).toBeTruthy();
    expect(screen.getByText("3 of 7 days")).toBeTruthy();
    expect(screen.getByLabelText("Monday, practiced")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Free chat" })).toBeTruthy();
    expect(screen.getByText("Talk about anything")).toBeTruthy();
    expect(
      within(screen.getByRole("button", { name: "Free chat" })).getByTestId("icon-ask", {
        includeHiddenElements: true,
      }),
    ).toBeTruthy();
    expect(screen.getByRole("button", { name: "Pick a topic" })).toBeTruthy();
    expect(screen.getByText("Going to vs will, tenses…")).toBeTruthy();
    expect(screen.getByText("Continue")).toBeTruthy();
    expect(screen.getByText("Weekend plans")).toBeTruthy();
    expect(screen.getByText("Job interviews · yesterday")).toBeTruthy();
    expect(screen.getByText("Resume")).toBeTruthy();
  });

  it("draws no Suggested for you carousel", async () => {
    await renderApp("/", fakeSession());
    expect(screen.queryByText("Suggested for you")).toBeNull();
    expect(screen.queryByRole("link", { name: "See all" })).toBeNull();
  });

  it("draws today's run with its ring and Keep going", async () => {
    fakeData.getTodayPractice.mockResolvedValue({
      ok: true,
      value: practiceTodayWith([
        practiceItemWith({ id: "i0", position: 0, correct: true, rule: "Present perfect" }),
        practiceItemWith({ id: "i1", position: 1, correct: false, rule: "Articles" }),
        practiceItemWith({ id: "i2", position: 2 }),
        practiceItemWith({ id: "i3", position: 3 }),
        practiceItemWith({ id: "i4", position: 4 }),
      ]),
    });
    await renderApp("/", fakeSession());
    expect(screen.getByText("2/5")).toBeTruthy();
    expect(screen.getByText("From your mistakes")).toBeTruthy();
    expect(screen.getByText("3 left · about 4 min")).toBeTruthy();
    expect(screen.getByText("Present perfect")).toBeTruthy();
    expect(screen.getByText("Articles")).toBeTruthy();
    expect(screen.getByText("Keep going")).toBeTruthy();
  });

  it("titles a note run From your note", async () => {
    fakeData.getTodayPractice.mockResolvedValue({
      ok: true,
      value: practiceTodayWith([practiceItemWith({ id: "i0", position: 0 })], {
        focus: "note",
        noteId: "note-1",
      }),
    });
    await renderApp("/", fakeSession());
    expect(screen.getByText("From your note")).toBeTruthy();
    expect(screen.queryByText("From your mistakes")).toBeNull();
  });

  it("draws the start state with no run today", async () => {
    fakeData.listMistakes.mockResolvedValue({
      ok: true,
      value: { items: [mistakeGroupWith({ rule: "Articles" })], nextOffset: null },
    });
    await renderApp("/", fakeSession());
    expect(screen.getByText("0/5")).toBeTruthy();
    expect(screen.getByText("5 left · about 6 min")).toBeTruthy();
    expect(screen.getByText("Articles")).toBeTruthy();
    expect(screen.getByText("Start practice")).toBeTruthy();
  });

  it("draws a finished run as done with Practice again", async () => {
    fakeData.getTodayPractice.mockResolvedValue({
      ok: true,
      value: practiceTodayWith(
        [0, 1, 2, 3, 4].map((position) =>
          practiceItemWith({ id: `i${position}`, position, correct: true }),
        ),
        { finishedAt: "2026-11-05T11:00:00Z" },
      ),
    });
    await renderApp("/", fakeSession());
    expect(screen.getByText("Done for today")).toBeTruthy();
    expect(screen.getByText("Practice again")).toBeTruthy();
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
    expect(screen.getByText("Start practice")).toBeTruthy();
  });

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

  it("draws the failure when today's practice cannot be read", async () => {
    fakeData.getTodayPractice.mockResolvedValue({ ok: false, failure: "network" });
    await renderApp("/", fakeSession());
    expect(screen.getByText(dataFailureMessage("network"))).toBeTruthy();
    expect(screen.queryByText("Today's practice")).toBeNull();
  });

  it("draws the failure when the week read fails", async () => {
    fakeData.getSessionWeek.mockResolvedValue({ ok: false, failure: "unavailable" });
    await renderApp("/", fakeSession());
    expect(screen.getByText(dataFailureMessage("unavailable"))).toBeTruthy();
    expect(screen.queryByText("This week")).toBeNull();
  });

  it("opens the suggestions from Free chat", async () => {
    await renderApp("/", fakeSession());
    await fireEvent.press(screen.getByRole("button", { name: "Free chat" }));
    expect(screen).toHavePathname("/suggestions");
  });

  it("opens Practice from Pick a topic", async () => {
    await renderApp("/", fakeSession());
    await fireEvent.press(screen.getByRole("button", { name: "Pick a topic" }));
    expect(screen).toHavePathname("/practice");
  });

  it("opens the focus screen from the card with no run today", async () => {
    await renderApp("/", fakeSession());
    await fireEvent.press(screen.getByRole("button", { name: /^Today's practice,/ }));
    expect(screen).toHavePathname("/practice");
  });

  it("opens the run from the card with an unfinished run", async () => {
    fakeData.getTodayPractice.mockResolvedValue({
      ok: true,
      value: practiceTodayWith([practiceItemWith()], { id: "run-9" }),
    });
    await renderApp("/", fakeSession());
    await fireEvent.press(screen.getByRole("button", { name: /^Today's practice,/ }));
    expect(screen).toHavePathname("/practice-run");
    expect(screen).toHaveSearchParams({ run: "run-9" });
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

  it("pads the end of Home by the tab bar clearance so the last card clears the bar", async () => {
    await renderApp("/", fakeSession());
    const style = StyleSheet.flatten(
      screen.getByTestId("home-content").props.contentContainerStyle,
    );
    expect(style.paddingBottom).toBe(tabBarLayout(0).clearance);
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
    expect(screen.getByRole("header", { name: "Settings" })).toBeTruthy();
  });

  it("opens Profile from the avatar labelled Profile", async () => {
    await renderApp("/", fakeSession());
    await fireEvent.press(screen.getByRole("button", { name: "Profile" }));
    expect(screen).toHavePathname("/profile");
  });

  it("plays the tab haptic when Settings is pressed", async () => {
    await renderApp("/", fakeSession());
    await fireEvent.press(screen.getByTestId("tab-settings"));
    expect(fakeHaptics.play).toHaveBeenCalledWith("tab");
    expect(fakeHaptics.play).toHaveBeenCalledTimes(1);
  });

  it("plays nothing when the stored setting is off", async () => {
    // INFO: the setting is read from the device on launch, so an off saved before survives a restart.
    fakeHapticsSetting.read.mockResolvedValue({ ok: true, value: false });
    await renderApp("/", fakeSession());
    await fireEvent.press(screen.getByTestId("tab-settings"));
    expect(fakeHaptics.play).not.toHaveBeenCalled();
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
