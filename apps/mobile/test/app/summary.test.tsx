// apps/mobile/test/app/summary.test.tsx
//
// Tests for the Summary screen.
//
// Tested:
// - Loading, with data, expected empty (no corrections, no words) and error states
// - The check, Nice work with the name, the title and topic, and the three stats
// - The corrections to review with their rule, a correction saved without a rule, the new words
// - From a chat: Back to Home and See it in Progress, with no Back arrow
// - From History: Back to Progress and Practice this topic again instead of Back to Home
//
// What is covered:
// - Normal case, empty case, edges
//
// Run with: pnpm exec jest apps/mobile/test/app/summary.test.tsx
//
// SEE: apps/mobile/src/app/summary.tsx

import { beforeEach, describe, expect, it, jest } from "@jest/globals";
import { act, fireEvent, screen } from "@testing-library/react-native";
import { router } from "expo-router";

import { noCorrectionsText } from "@/utils/summary";
import { dataFailureMessage } from "@/utils/data-message";
import { fakeSession, resetFakeAuth } from "../helpers/fake-auth";
import { fakeData, profileWith, resetFakeData, summaryWith } from "../helpers/fake-data";
import { resetFakeKeys } from "../helpers/fake-keys";
import { renderAppAt } from "../helpers/render-app";

jest.mock("expo-font", () => ({ useFonts: jest.fn(() => [true, null]) }));
jest.mock("expo-splash-screen", () => ({
  preventAutoHideAsync: jest.fn(),
  hide: jest.fn(),
}));
jest.mock("@/data", () => ({
  data: jest.requireActual<typeof import("../helpers/fake-data")>("../helpers/fake-data").fakeData,
}));
jest.mock("@/keys", () => ({
  keys: jest.requireActual<typeof import("../helpers/fake-keys")>("../helpers/fake-keys").fakeKeys,
}));
jest.mock("@/auth", () => {
  const fake = jest.requireActual<typeof import("../helpers/fake-auth")>("../helpers/fake-auth");
  return { auth: fake.fakeAuth, apple: fake.fakeApple };
});

const fromChat = { pathname: "/summary", params: { session: "session-1" } } as const;
const fromHistory = {
  pathname: "/summary",
  params: { session: "session-1", from: "history" },
} as const;

const full = summaryWith(
  {
    messageCount: 14,
    corrections: [
      {
        original: "I never been",
        corrected: "I've never been",
        rule: "Present perfect for experiences",
      },
      { original: "a apple", corrected: "an apple" },
    ],
    newWords: ["definitely", "deadline"],
  },
  { title: "Tell me about yourself", topicId: "job_interviews" },
);

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

describe("Summary", () => {
  beforeEach(() => {
    resetFakeAuth();
    resetFakeData();
    resetFakeKeys();
    fakeData.getProfile.mockResolvedValue({
      ok: true,
      value: profileWith({ displayName: "Maxi", onboardingCompletedAt: "2026-11-05T10:00:00Z" }),
    });
  });

  it("draws the loading state while the summary is read", async () => {
    const pending = deferred<Awaited<ReturnType<typeof fakeData.getSessionSummary>>>();
    fakeData.getSessionSummary.mockReturnValue(pending.promise);
    await renderAppAt(fromChat, fakeSession());
    expect(await screen.findByTestId("summary-loading")).toBeTruthy();

    await act(async () => pending.resolve({ ok: true, value: summaryWith() }));

    expect(screen.queryByTestId("summary-loading")).toBeNull();
  });

  it("draws the check, Nice work with the name, the title and topic, and the three stats", async () => {
    fakeData.getSessionSummary.mockResolvedValue({ ok: true, value: full });
    await renderAppAt(fromChat, fakeSession());

    expect(await screen.findByTestId("done-badge", { includeHiddenElements: true })).toBeTruthy();
    expect(screen.getByRole("header", { name: "Nice work, Maxi!" })).toBeTruthy();
    expect(screen.getByText("Tell me about yourself · Job interviews")).toBeTruthy();
    expect(screen.getAllByTestId("stat-card")).toHaveLength(3);
    expect(screen.getByText("14")).toBeTruthy();
    expect(screen.getAllByText("2")).toHaveLength(2);
    expect(screen.getByText("Messages")).toBeTruthy();
    expect(screen.getByText("Corrections")).toBeTruthy();
    expect(screen.getAllByText("New words")).toHaveLength(2);
  });

  it("lists each correction to review with its rule, and the new words as chips", async () => {
    fakeData.getSessionSummary.mockResolvedValue({ ok: true, value: full });
    await renderAppAt(fromChat, fakeSession());

    expect(await screen.findByText("To review")).toBeTruthy();
    expect(screen.getByText("I never been")).toBeTruthy();
    expect(screen.getByText(/I've never been/)).toBeTruthy();
    expect(screen.getByText("Present perfect for experiences")).toBeTruthy();
    expect(screen.getByText("a apple")).toBeTruthy();
    expect(screen.getByText(/an apple/)).toBeTruthy();
    expect(screen.getAllByText("New words")).toHaveLength(2);
    expect(screen.getByText("definitely")).toBeTruthy();
    expect(screen.getByText("deadline")).toBeTruthy();
  });

  it("draws a correction saved without a rule", async () => {
    fakeData.getSessionSummary.mockResolvedValue({
      ok: true,
      value: summaryWith({ corrections: [{ original: "goed", corrected: "went" }] }),
    });
    await renderAppAt(fromChat, fakeSession());

    expect(await screen.findByText("goed")).toBeTruthy();
    expect(screen.getByText(/went/)).toBeTruthy();
    expect(screen.getByTestId("review-card").children).toHaveLength(1);
  });

  it("says Nice work! without a name", async () => {
    fakeData.getProfile.mockResolvedValue({
      ok: true,
      value: profileWith({ onboardingCompletedAt: "2026-11-05T10:00:00Z" }),
    });
    await renderAppAt(fromChat, fakeSession());

    expect(await screen.findByRole("header", { name: "Nice work!" })).toBeTruthy();
  });

  it("draws No corrections this time. and hides To review for a session with no corrections", async () => {
    fakeData.getSessionSummary.mockResolvedValue({
      ok: true,
      value: summaryWith({ messageCount: 2, newWords: ["definitely"] }),
    });
    await renderAppAt(fromChat, fakeSession());

    expect(await screen.findByText(noCorrectionsText)).toBeTruthy();
    expect(screen.queryByText("To review")).toBeNull();
  });

  it("hides New words for a session with no new words", async () => {
    fakeData.getSessionSummary.mockResolvedValue({
      ok: true,
      value: summaryWith({ corrections: [{ original: "goed", corrected: "went" }] }),
    });
    await renderAppAt(fromChat, fakeSession());

    expect(await screen.findByText("To review")).toBeTruthy();
    expect(screen.getAllByText("New words")).toHaveLength(1);
  });

  it("draws zeros, No corrections this time. and no sections for an empty session", async () => {
    await renderAppAt(fromChat, fakeSession());

    expect(await screen.findByText(noCorrectionsText)).toBeTruthy();
    expect(screen.getAllByText("0")).toHaveLength(3);
    expect(screen.queryByText("To review")).toBeNull();
    expect(screen.getAllByText("New words")).toHaveLength(1);
  });

  it("draws the error with Try again, and Try again reads again", async () => {
    fakeData.getSessionSummary.mockResolvedValueOnce({ ok: false, failure: "network" });
    fakeData.getSessionSummary.mockResolvedValue({ ok: true, value: full });
    await renderAppAt(fromChat, fakeSession());

    expect(await screen.findByText(dataFailureMessage("network"))).toBeTruthy();
    await fireEvent.press(screen.getByRole("button", { name: "Try again" }));

    expect(await screen.findByText("To review")).toBeTruthy();
    expect(fakeData.getSessionSummary).toHaveBeenCalledTimes(2);
    expect(screen.queryByText(dataFailureMessage("network"))).toBeNull();
  });

  it("draws the not-found error for a session that is not the user's", async () => {
    fakeData.getSessionSummary.mockResolvedValue({ ok: false, failure: "not_found" });
    await renderAppAt(fromChat, fakeSession());

    expect(await screen.findByText(dataFailureMessage("not_found"))).toBeTruthy();
  });

  it("from a chat, Back to Home goes Home", async () => {
    await renderAppAt(fromChat, fakeSession());

    await fireEvent.press(await screen.findByRole("button", { name: "Back to Home" }));

    expect(screen).toHavePathname("/");
  });

  it("from a chat, See it in Progress opens the Progress tab", async () => {
    await renderAppAt(fromChat, fakeSession());

    await fireEvent.press(await screen.findByRole("link", { name: "See it in Progress" }));

    expect(screen).toHavePathname("/progress");
  });

  it("from a chat, has no Back arrow and no Practice this topic again", async () => {
    await renderAppAt(fromChat, fakeSession());

    await screen.findByRole("button", { name: "Back to Home" });
    expect(screen.queryByRole("button", { name: "Back to Progress" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Practice this topic again" })).toBeNull();
  });

  it("from History, draws Back to Progress and Practice this topic again instead of Back to Home", async () => {
    await renderAppAt(fromHistory, fakeSession());

    expect(await screen.findByRole("button", { name: "Back to Progress" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Practice this topic again" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Back to Home" })).toBeNull();
    expect(screen.getByRole("link", { name: "See it in Progress" })).toBeTruthy();
  });

  it("from History, Back returns to Progress", async () => {
    await renderAppAt("/progress", fakeSession());
    await act(async () => router.push(fromHistory));

    await fireEvent.press(await screen.findByRole("button", { name: "Back to Progress" }));

    expect(screen).toHavePathname("/progress");
  });

  it("from History, Practice this topic again starts a chat on that topic", async () => {
    fakeData.getSessionSummary.mockResolvedValue({ ok: true, value: full });
    await renderAppAt(fromHistory, fakeSession());

    await fireEvent.press(await screen.findByRole("button", { name: "Practice this topic again" }));

    expect(screen).toHavePathname("/chat");
    expect(screen).toHaveSearchParams({ topic: "job_interviews" });
  });

  it("from History, Practice this topic again starts a free chat for a session without a topic", async () => {
    await renderAppAt(fromHistory, fakeSession());

    await fireEvent.press(await screen.findByRole("button", { name: "Practice this topic again" }));

    expect(screen).toHavePathname("/chat");
    expect(screen).toHaveSearchParams({});
  });
});
