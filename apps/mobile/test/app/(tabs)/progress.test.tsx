// apps/mobile/test/app/(tabs)/progress.test.tsx
//
// Tests for the Progress screen.
//
// Tested:
// - Loading, with data, expected empty and error states, for each section
// - The month's three stats and the History · Mistakes · Words tabs, History first
// - A History row opens its Summary from history
// - The next page loads at the end of the list, and its failure keeps the rows and offers Try again
// - The end of Progress is padded by the tab bar clearance
// - Signed out users cannot reach Progress
//
// What is covered:
// - Normal case, empty case, edges
//
// Run with: pnpm exec jest "apps/mobile/test/app/(tabs)/progress.test.tsx"
//
// SEE: apps/mobile/src/app/(tabs)/progress.tsx

import { beforeEach, describe, expect, it, jest } from "@jest/globals";
import { fireEvent, screen, within } from "@testing-library/react-native";
import { StyleSheet } from "react-native";

import { dataFailureMessage } from "@/utils/data-message";
import { tabBarLayout } from "@/utils/tab-bar";

import { fakeSession, resetFakeAuth } from "../../helpers/fake-auth";
import {
  fakeData,
  historyItemWith,
  mistakeGroupWith,
  newWordWith,
  resetFakeData,
} from "../../helpers/fake-data";
import { resetFakeKeys } from "../../helpers/fake-keys";
import { renderApp, renderAppAt } from "../../helpers/render-app";

jest.mock("expo-font", () => ({ useFonts: jest.fn(() => [true, null]) }));
jest.mock("@/utils/time-zone", () => ({ deviceTimeZone: jest.fn(() => "America/Lima") }));
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

const month = { monthStart: "2026-11-01", sessions: 12, corrections: 31, newWords: 48 };

function withHistory(count = 2) {
  fakeData.getMonthProgress.mockResolvedValue({ ok: true, value: month });
  fakeData.listHistory.mockResolvedValue({
    ok: true,
    value: {
      items: [
        historyItemWith(
          { day: "2026-11-05", messageCount: 14, correctionCount: 3 },
          { id: "session-1", title: "Tell me about yourself" },
        ),
        historyItemWith(
          { day: "2026-11-03", messageCount: 8, correctionCount: 1 },
          { id: "session-2", title: "Weekend plans" },
        ),
      ].slice(0, count),
      nextOffset: null,
    },
  });
}

describe("Progress", () => {
  beforeEach(() => {
    resetFakeAuth();
    resetFakeData();
    resetFakeKeys();
  });

  it("shows a spinner while Progress loads", async () => {
    fakeData.getMonthProgress.mockReturnValue(new Promise(() => {}));
    await renderAppAt("/progress", fakeSession());
    expect(screen.getByTestId("progress-loading")).toBeTruthy();
  });

  it("draws Progress, This month and the month's three stats", async () => {
    withHistory();
    await renderAppAt("/progress", fakeSession());

    expect(await screen.findByText("This month")).toBeTruthy();
    expect(screen.getByRole("header", { name: "Progress" })).toBeTruthy();
    const tiles = screen.getAllByTestId("stat-card");
    expect(tiles).toHaveLength(3);
    const expected = [
      ["12", "Sessions"],
      ["31", "Corrections"],
      ["48", "New words"],
    ];
    for (const [index, [value, label]] of expected.entries()) {
      expect(within(tiles[index]).getByText(value)).toBeTruthy();
      expect(within(tiles[index]).getByText(label)).toBeTruthy();
    }
    expect(fakeData.getMonthProgress).toHaveBeenCalledWith("America/Lima");
  });

  it("selects History first, drawn as a tab", async () => {
    withHistory();
    await renderAppAt("/progress", fakeSession());

    const history = await screen.findByRole("tab", { name: "History" });
    expect(history.props.accessibilityState.selected).toBe(true);
    expect(screen.getByRole("tab", { name: "Mistakes" }).props.accessibilityState.selected).toBe(
      false,
    );
    expect(screen.getByRole("tab", { name: "Words" })).toBeTruthy();
  });

  it("draws each ended session with its title, date and messages and corrections line", async () => {
    withHistory();
    await renderAppAt("/progress", fakeSession());

    expect(await screen.findByText("Tell me about yourself")).toBeTruthy();
    expect(screen.getByText("Nov 5")).toBeTruthy();
    expect(screen.getByText("14 messages · 3 corrections")).toBeTruthy();
    expect(screen.getByText("Weekend plans")).toBeTruthy();
    expect(screen.getByText("Nov 3")).toBeTruthy();
    expect(screen.getByText("8 messages · 1 correction")).toBeTruthy();
  });

  it("opens the session's Summary from history when a row is pressed", async () => {
    withHistory();
    await renderAppAt("/progress", fakeSession());

    await fireEvent.press(await screen.findByRole("button", { name: "Tell me about yourself" }));

    expect(screen).toHavePathname("/summary");
    expect(screen).toHaveSearchParams({ session: "session-1", from: "history" });
    expect(await screen.findByRole("button", { name: "Back to Progress" })).toBeTruthy();
  });

  it("draws each mistake group with its rule, times and struck example, and Other for no rule", async () => {
    fakeData.listMistakes.mockResolvedValue({
      ok: true,
      value: {
        items: [
          mistakeGroupWith({
            rule: "Present perfect",
            times: 5,
            latest: { original: "I have went", corrected: "I have gone" },
          }),
          mistakeGroupWith({ rule: null, times: 1, latest: { original: "a", corrected: "b" } }),
        ],
        nextOffset: null,
      },
    });
    await renderAppAt("/progress", fakeSession());

    await fireEvent.press(await screen.findByRole("tab", { name: "Mistakes" }));

    expect(screen.getByText("Present perfect")).toBeTruthy();
    expect(screen.getByText("5 times")).toBeTruthy();
    expect(screen.getByText("I have went")).toBeTruthy();
    expect(screen.getByText(/→ I have gone/)).toBeTruthy();
    expect(screen.getByText("Other")).toBeTruthy();
    expect(screen.getByText("1 time")).toBeTruthy();
  });

  it("draws each word with its quoted sentence and date", async () => {
    fakeData.listWords.mockResolvedValue({
      ok: true,
      value: {
        items: [
          newWordWith({ word: "catchy", sentence: "That song is catchy.", day: "2026-11-05" }),
        ],
        nextOffset: null,
      },
    });
    await renderAppAt("/progress", fakeSession());

    await fireEvent.press(await screen.findByRole("tab", { name: "Words" }));

    expect(screen.getByText("catchy")).toBeTruthy();
    expect(screen.getByText('"That song is catchy."')).toBeTruthy();
    expect(screen.getByText("Nov 5")).toBeTruthy();
  });

  it("says No finished chats yet., No mistakes yet. and No new words yet. on empty sections", async () => {
    await renderAppAt("/progress", fakeSession());

    expect(await screen.findByText("No finished chats yet.")).toBeTruthy();
    await fireEvent.press(screen.getByRole("tab", { name: "Mistakes" }));
    expect(screen.getByText("No mistakes yet.")).toBeTruthy();
    await fireEvent.press(screen.getByRole("tab", { name: "Words" }));
    expect(screen.getByText("No new words yet.")).toBeTruthy();
  });

  it("shows zeros, not an error, for a month with nothing", async () => {
    await renderAppAt("/progress", fakeSession());

    await screen.findByText("This month");
    const tiles = screen.getAllByTestId("stat-card");
    for (const tile of tiles) expect(within(tile).getByText("0")).toBeTruthy();
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("shows the failure and reads again on Try again", async () => {
    fakeData.listWords.mockResolvedValueOnce({ ok: false, failure: "network" });
    withHistory();
    await renderAppAt("/progress", fakeSession());

    expect(await screen.findByText(dataFailureMessage("network"))).toBeTruthy();
    await fireEvent.press(screen.getByRole("button", { name: "Try again" }));

    expect(await screen.findByText("This month")).toBeTruthy();
    expect(screen.queryByText(dataFailureMessage("network"))).toBeNull();
  });

  it("loads the next page at the end of the list", async () => {
    fakeData.listHistory.mockResolvedValueOnce({
      ok: true,
      value: {
        items: [historyItemWith({}, { id: "session-1", title: "First chat" })],
        nextOffset: 20,
      },
    });
    fakeData.listHistory.mockResolvedValueOnce({
      ok: true,
      value: {
        items: [historyItemWith({}, { id: "session-2", title: "Second page chat" })],
        nextOffset: null,
      },
    });
    await renderAppAt("/progress", fakeSession());
    await screen.findByText("First chat");

    await fireEvent(screen.getByTestId("progress-content"), "endReached");

    expect(await screen.findByText("Second page chat")).toBeTruthy();
    expect(fakeData.listHistory).toHaveBeenLastCalledWith("America/Lima", 20);
    expect(screen.getByText("First chat")).toBeTruthy();
  });

  it("keeps the rows and offers Try again when the next page fails", async () => {
    fakeData.listHistory.mockResolvedValueOnce({
      ok: true,
      value: {
        items: [historyItemWith({}, { id: "session-1", title: "First chat" })],
        nextOffset: 20,
      },
    });
    fakeData.listHistory.mockResolvedValueOnce({ ok: false, failure: "network" });
    await renderAppAt("/progress", fakeSession());
    await screen.findByText("First chat");

    await fireEvent(screen.getByTestId("progress-content"), "endReached");

    expect(await screen.findByText(dataFailureMessage("network"))).toBeTruthy();
    expect(screen.getByText("First chat")).toBeTruthy();
    fakeData.listHistory.mockResolvedValueOnce({
      ok: true,
      value: {
        items: [historyItemWith({}, { id: "session-2", title: "Second page chat" })],
        nextOffset: null,
      },
    });
    await fireEvent.press(screen.getByRole("button", { name: "Try again" }));
    expect(await screen.findByText("Second page chat")).toBeTruthy();
  });

  it("pads the end of Progress by the tab bar clearance", async () => {
    await renderAppAt("/progress", fakeSession());
    await screen.findByText("This month");
    const style = StyleSheet.flatten(
      screen.getByTestId("progress-content").props.contentContainerStyle,
    );
    expect(style.paddingBottom).toBe(tabBarLayout(0).clearance);
  });

  it("lands on Login when signed out at Progress", async () => {
    await renderApp("/progress", null);
    expect(screen).toHavePathname("/sign-in");
    expect(screen.queryByText("Progress")).toBeNull();
  });
});
