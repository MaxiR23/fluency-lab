// apps/mobile/test/hooks/use-practice-run.test.tsx
//
// Tests for the practice run hook.
//
// Tested:
// - The key, the profile, the spend, the run and the focus data read from their ports; no key and each failure
// - A new run is created, the first round is asked with the focus data only, and its items and usage are saved
// - A right pick and a typed match are answered with no tutor call; a typed miss asks the tutor
// - A billed AI failure saves its usage; an AI failure resends and a write failure resumes
// - A note run reads its note and sends it in the round call; a missed exercise makes a study note, saves it with no session, adds its usage to the run and opens it
// - Keep going, finish and stop; update key
// - Reads the recent prompts and sends them as avoid
// - Regaining focus re-reads the context
//
// What is covered:
// - Normal case, empty case, edges
//
// Run with: pnpm exec jest apps/mobile/test/hooks/use-practice-run.test.tsx
//
// SEE: apps/mobile/src/hooks/use-practice-run.ts

import { beforeEach, describe, expect, it, jest } from "@jest/globals";
import { act, renderHook, waitFor } from "@testing-library/react-native";
import { router, useIsFocused } from "expo-router";

import { usePracticeRun } from "@/hooks/use-practice-run";
import { dataFailureMessage } from "@/utils/data-message";
import { practiceNoteGoneMessage, practiceNotFoundMessage } from "@/utils/practice-run-state";
import type { PracticeOrigin } from "@/utils/practice-focus";
import {
  answerGradeWith,
  exerciseWith,
  fakeAi,
  practiceRoundWith,
  resetFakeAi,
  studyNoteReplyWith,
} from "../helpers/fake-ai";
import {
  fakeData,
  mistakeGroupWith,
  practiceItemWith,
  practiceRunWith,
  practiceTodayWith,
  profileWith,
  resetFakeData,
} from "../helpers/fake-data";
import { fakeKeys, resetFakeKeys } from "../helpers/fake-keys";
import { failThenHold } from "../helpers/fail-then-hold";

jest.mock("expo-router", () => ({
  useIsFocused: jest.fn(() => true),
  router: { push: jest.fn(), dismissTo: jest.fn() },
}));
jest.mock("@/utils/time-zone", () => ({ deviceTimeZone: jest.fn(() => "UTC") }));
jest.mock("@/utils/device-language", () => ({ deviceLanguage: jest.fn(() => null) }));
jest.mock("@/data", () => ({
  data: jest.requireActual<typeof import("../helpers/fake-data")>("../helpers/fake-data").fakeData,
}));
jest.mock("@/keys", () => ({
  keys: jest.requireActual<typeof import("../helpers/fake-keys")>("../helpers/fake-keys").fakeKeys,
}));
jest.mock("@/ai", () => ({
  ai: jest.requireActual<typeof import("../helpers/fake-ai")>("../helpers/fake-ai").fakeAi,
}));

const newRun: PracticeOrigin = { kind: "new", input: { focus: "mistakes", target: 5 } };

function withKey(overrides: Parameters<typeof profileWith>[0] = {}) {
  fakeKeys.hasApiKey.mockResolvedValue({ ok: true, value: true });
  fakeData.getProfile.mockResolvedValue({
    ok: true,
    value: profileWith({
      displayName: "Ada",
      level: "intermediate",
      provider: "claude",
      monthlyLimitUsd: 10,
      onboardingCompletedAt: "2026-11-05T10:00:00Z",
      ...overrides,
    }),
  });
  fakeData.listMistakes.mockResolvedValue({
    ok: true,
    value: {
      items: [mistakeGroupWith({ rule: "Present perfect" })],
      nextOffset: null,
    },
  });
  fakeData.createPracticeRun.mockImplementation(async (input) => ({
    ok: true,
    value: practiceRunWith({ focus: input.focus, target: input.target }),
  }));
  fakeData.addPracticeItems.mockImplementation(async (runId, items) => ({
    ok: true,
    value: items.map((item) => practiceItemWith({ ...item, id: `item-${item.position}`, runId })),
  }));
  fakeData.addPracticeUsage.mockResolvedValue({ ok: true, value: practiceRunWith() });
  fakeData.answerPracticeItem.mockImplementation(async (itemId, answer) => ({
    ok: true,
    value: practiceItemWith({ id: itemId, ...answer }),
  }));
  fakeData.finishPracticeRun.mockResolvedValue({
    ok: true,
    value: practiceRunWith({ finishedAt: "2026-11-05T11:00:00Z" }),
  });
  fakeData.setPracticeTarget.mockImplementation(async (_id, target) => ({
    ok: true,
    value: practiceRunWith({ target }),
  }));
}

function ready(result: { current: ReturnType<typeof usePracticeRun> }) {
  const { view } = result.current;
  if (view.kind !== "ready") throw new Error(`expected ready, got ${view.kind}`);
  return view.run;
}

describe("usePracticeRun", () => {
  beforeEach(() => {
    resetFakeData();
    resetFakeKeys();
    resetFakeAi();
    jest.mocked(useIsFocused).mockReturnValue(true);
    jest.mocked(router.push).mockClear();
    jest.mocked(router.dismissTo).mockClear();
  });

  it("is loading, then creates the run and asks the first round", async () => {
    withKey();
    let finish!: (value: Awaited<ReturnType<typeof fakeData.getProfile>>) => void;
    fakeData.getProfile.mockReturnValue(
      new Promise((resolve) => {
        finish = resolve;
      }),
    );
    const { result } = await renderHook(() => usePracticeRun(newRun));
    expect(result.current.view).toEqual({ kind: "loading" });
    await act(async () =>
      finish({ ok: true, value: profileWith({ provider: "claude", monthlyLimitUsd: 10 }) }),
    );
    await waitFor(() => expect(ready(result).phase).toBe("answering"));
    expect(fakeData.createPracticeRun).toHaveBeenCalledWith({ focus: "mistakes", target: 5 });
    expect(fakeAi.practiceRound).toHaveBeenCalledTimes(1);
    expect(fakeData.addPracticeItems).toHaveBeenCalledWith("run-1", expect.any(Array));
    expect(fakeData.addPracticeUsage).toHaveBeenCalledTimes(1);
    expect(ready(result).items).toHaveLength(5);
  });

  it("sends only the focus data and the count in the round, no chat text", async () => {
    withKey();
    const { result } = await renderHook(() => usePracticeRun(newRun));
    await waitFor(() => expect(ready(result).phase).toBe("answering"));
    const [request] = fakeAi.practiceRound.mock.calls[0];
    expect(request.turns).toHaveLength(1);
    expect(JSON.parse(request.turns[0].text)).toEqual({
      focus: {
        kind: "mistakes",
        corrections: [
          { original: "I have went", corrected: "I have gone", rule: "Present perfect" },
        ],
      },
      count: 7,
      avoid: [],
    });
    expect(fakeAi.practiceRound.mock.calls[0]?.[1]).toBe(5);
    expect(fakeAi.practiceRound.mock.calls[0]?.[2]).toEqual([]);
    expect(request.system).not.toContain("Ada");
  });

  it("reads the recent prompts of the last seven days, forty at most", async () => {
    withKey();
    const { result } = await renderHook(() => usePracticeRun(newRun));
    await waitFor(() => expect(ready(result).phase).toBe("answering"));
    expect(fakeData.listRecentPrompts).toHaveBeenCalledWith(7, 40);
  });

  it("sends the recent prompts as avoid and to the round's validation", async () => {
    withKey();
    fakeData.listRecentPrompts.mockResolvedValue({
      ok: true,
      value: [{ runId: "old-run", prompt: "I ___ (be) there.", rule: "Present perfect" }],
    });
    const { result } = await renderHook(() => usePracticeRun(newRun));
    await waitFor(() => expect(ready(result).phase).toBe("answering"));
    const [request, , avoid] = fakeAi.practiceRound.mock.calls[0];
    expect(JSON.parse(request.turns[0].text).avoid).toEqual(["I ___ (be) there."]);
    expect(avoid).toEqual(["I ___ (be) there."]);
  });

  it("shows the failure when the recent prompts cannot be read", async () => {
    withKey();
    fakeData.listRecentPrompts.mockResolvedValue({ ok: false, failure: "network" });
    const { result } = await renderHook(() => usePracticeRun(newRun));
    await waitFor(() => expect(result.current.view.kind).toBe("failed"));
    expect(fakeAi.practiceRound).not.toHaveBeenCalled();
  });

  it("reads the spend in the device's time zone", async () => {
    withKey();
    const { result } = await renderHook(() => usePracticeRun(newRun));
    await waitFor(() => expect(ready(result).phase).toBe("answering"));
    expect(fakeData.getMonthSpend).toHaveBeenCalledWith("UTC");
  });

  it("is no_key without a key and reads nothing else", async () => {
    fakeKeys.hasApiKey.mockResolvedValue({ ok: true, value: false });
    const { result } = await renderHook(() => usePracticeRun(newRun));
    await waitFor(() => expect(result.current.view).toEqual({ kind: "no_key" }));
    expect(fakeData.getMonthSpend).not.toHaveBeenCalled();
    expect(fakeAi.practiceRound).not.toHaveBeenCalled();
  });

  it("fails with not found for an unknown origin", async () => {
    withKey();
    const { result } = await renderHook(() => usePracticeRun(null));
    await waitFor(() =>
      expect(result.current.view).toEqual({ kind: "failed", message: practiceNotFoundMessage }),
    );
  });

  it("keeps the network failure, retrying, while Try again reads again", async () => {
    withKey();
    const reread = failThenHold(fakeData.getProfile, { ok: false, failure: "network" });
    const { result } = await renderHook(() => usePracticeRun(newRun));
    await waitFor(() => expect(result.current.view.kind).toBe("failed"));
    let pending: Promise<void> = Promise.resolve();
    await act(async () => {
      pending = result.current.retry();
    });
    expect(result.current.view).toEqual({
      kind: "failed",
      message: "Could not reach the server. Check your connection and try again.",
      network: true,
      retrying: true,
    });
    reread.release();
    await act(async () => pending);
    expect(result.current.view.kind).toBe("ready");
  });

  it("fails when the run cannot be created and retries without asking twice", async () => {
    withKey();
    fakeData.createPracticeRun.mockResolvedValueOnce({ ok: false, failure: "network" });
    const { result } = await renderHook(() => usePracticeRun(newRun));
    await waitFor(() =>
      expect(ready(result).failure).toEqual({ source: "data", failure: "network" }),
    );
    expect(fakeAi.practiceRound).not.toHaveBeenCalled();
    await act(async () => result.current.retry());
    await waitFor(() => expect(ready(result).phase).toBe("answering"));
    expect(fakeData.createPracticeRun).toHaveBeenCalledTimes(2);
    expect(fakeAi.practiceRound).toHaveBeenCalledTimes(1);
  });

  it("fails on a spend read failure", async () => {
    withKey();
    fakeData.getMonthSpend.mockResolvedValue({ ok: false, failure: "unavailable" });
    const { result } = await renderHook(() => usePracticeRun(newRun));
    await waitFor(() =>
      expect(result.current.view).toEqual({
        kind: "failed",
        message: dataFailureMessage("unavailable"),
      }),
    );
  });

  it("opens a run to continue and goes straight to its first unanswered item", async () => {
    withKey();
    fakeData.openPracticeRun.mockResolvedValue({
      ok: true,
      value: practiceTodayWith(
        [0, 1, 2, 3, 4].map((position) =>
          practiceItemWith({
            id: `item-${position}`,
            position,
            correct: position < 2 ? true : null,
          }),
        ),
      ),
    });
    const { result } = await renderHook(() => usePracticeRun({ kind: "resume", runId: "run-1" }));
    await waitFor(() => expect(ready(result).phase).toBe("answering"));
    expect(fakeData.openPracticeRun).toHaveBeenCalledWith("run-1");
    expect(fakeData.createPracticeRun).not.toHaveBeenCalled();
    expect(fakeAi.practiceRound).not.toHaveBeenCalled();
  });

  it("fails with not found for another user's run", async () => {
    withKey();
    fakeData.openPracticeRun.mockResolvedValue({ ok: false, failure: "not_found" });
    const { result } = await renderHook(() => usePracticeRun({ kind: "resume", runId: "run-9" }));
    await waitFor(() =>
      expect(result.current.view).toEqual({ kind: "failed", message: practiceNotFoundMessage }),
    );
  });

  it("answers a right pick with no tutor call and saves the answer", async () => {
    withKey();
    const { result } = await renderHook(() => usePracticeRun(newRun));
    await waitFor(() => expect(ready(result).phase).toBe("answering"));
    await act(async () => result.current.pick("have been"));
    await waitFor(() => expect(ready(result).phase).toBe("feedback"));
    expect(ready(result).feedback?.tone).toBe("right");
    expect(fakeAi.gradeAnswer).not.toHaveBeenCalled();
    expect(fakeData.answerPracticeItem).toHaveBeenCalledWith("item-0", {
      userAnswer: "have been",
      correct: true,
    });
  });

  it("answers a typed match with no tutor call", async () => {
    withKey();
    fakeAi.practiceRound.mockResolvedValue({
      ok: true,
      value: practiceRoundWith({
        items: Array.from({ length: 5 }, () =>
          exerciseWith({
            kind: "fix",
            prompt: "I never been.",
            options: null,
            accepted: ["I've never been."],
            source: null,
          }),
        ),
      }),
    });
    const { result } = await renderHook(() => usePracticeRun(newRun));
    await waitFor(() => expect(ready(result).phase).toBe("answering"));
    await act(async () => result.current.setDraft("i've never been"));
    await act(async () => result.current.check());
    await waitFor(() => expect(ready(result).phase).toBe("feedback"));
    expect(fakeAi.gradeAnswer).not.toHaveBeenCalled();
    expect(ready(result).feedback?.tone).toBe("right");
  });

  it("answers a gap typed as the whole sentence with no tutor call", async () => {
    withKey();
    fakeAi.practiceRound.mockResolvedValue({
      ok: true,
      value: practiceRoundWith({
        items: Array.from({ length: 5 }, () =>
          exerciseWith({
            kind: "gap",
            prompt: "I ___ (not / can) remember who made the shot!",
            options: null,
            accepted: ["can't"],
            source: null,
          }),
        ),
      }),
    });
    const { result } = await renderHook(() => usePracticeRun(newRun));
    await waitFor(() => expect(ready(result).phase).toBe("answering"));
    await act(async () => result.current.setDraft("I can't remember who made the shot."));
    await act(async () => result.current.check());
    await waitFor(() => expect(ready(result).phase).toBe("feedback"));
    expect(fakeAi.gradeAnswer).not.toHaveBeenCalled();
    expect(ready(result).feedback?.tone).toBe("right");
  });

  it("saves a flawed exercise as correct", async () => {
    withKey();
    fakeAi.practiceRound.mockResolvedValue({
      ok: true,
      value: practiceRoundWith({
        items: Array.from({ length: 5 }, () =>
          exerciseWith({
            kind: "fix",
            prompt: "I never been.",
            options: null,
            accepted: ["I've never been."],
            source: null,
          }),
        ),
      }),
    });
    fakeAi.gradeAnswer.mockResolvedValue({
      ok: true,
      value: answerGradeWith({ correct: false, flawed: true, explanation: "Two answers fit." }),
    });
    const { result } = await renderHook(() => usePracticeRun(newRun));
    await waitFor(() => expect(ready(result).phase).toBe("answering"));
    await act(async () => result.current.setDraft("I never was."));
    await act(async () => result.current.check());
    await waitFor(() => expect(ready(result).phase).toBe("feedback"));
    expect(fakeData.answerPracticeItem).toHaveBeenCalledWith(
      "item-0",
      expect.objectContaining({ correct: true }),
    );
  });

  it("asks the tutor for a typed miss and saves the answer and its usage", async () => {
    withKey();
    fakeAi.practiceRound.mockResolvedValue({
      ok: true,
      value: practiceRoundWith({
        items: Array.from({ length: 5 }, () =>
          exerciseWith({
            kind: "fix",
            prompt: "I never been.",
            options: null,
            accepted: ["I've never been."],
            source: null,
          }),
        ),
      }),
    });
    fakeAi.gradeAnswer.mockResolvedValue({
      ok: true,
      value: answerGradeWith({ correct: false, explanation: "Needs have." }),
    });
    const { result } = await renderHook(() => usePracticeRun(newRun));
    await waitFor(() => expect(ready(result).phase).toBe("answering"));
    fakeData.addPracticeUsage.mockClear();
    await act(async () => result.current.setDraft("I never was."));
    await act(async () => result.current.check());
    await waitFor(() => expect(ready(result).phase).toBe("feedback"));
    expect(fakeAi.gradeAnswer).toHaveBeenCalledTimes(1);
    expect(ready(result).feedback).toMatchObject({ tone: "miss", explanation: "Needs have." });
    expect(fakeData.answerPracticeItem).toHaveBeenCalledWith("item-0", {
      userAnswer: "I never was.",
      correct: false,
    });
    expect(fakeData.addPracticeUsage).toHaveBeenCalledTimes(1);
  });

  it("saves the usage of a billed failure and shows the failure", async () => {
    withKey();
    fakeAi.practiceRound.mockResolvedValue({
      ok: false,
      failure: "bad_response",
      usage: practiceRoundWith().usage,
    });
    const { result } = await renderHook(() => usePracticeRun(newRun));
    await waitFor(() => expect(ready(result).failure).not.toBeNull());
    expect(fakeData.addPracticeUsage).toHaveBeenCalledTimes(1);
    expect(ready(result).failure).toMatchObject({ source: "ai", failure: "bad_response" });
    expect(ready(result).phase).toBe("asking");
  });

  it("asks the round again on retry after an AI failure", async () => {
    withKey();
    fakeAi.practiceRound.mockResolvedValueOnce({ ok: false, failure: "network" });
    const { result } = await renderHook(() => usePracticeRun(newRun));
    await waitFor(() => expect(ready(result).failure).not.toBeNull());
    expect(fakeData.addPracticeUsage).not.toHaveBeenCalled();
    await act(async () => result.current.retry());
    await waitFor(() => expect(ready(result).phase).toBe("answering"));
    expect(fakeAi.practiceRound).toHaveBeenCalledTimes(2);
  });

  it("resumes at the failed write without asking the tutor again", async () => {
    withKey();
    fakeData.addPracticeItems.mockResolvedValueOnce({ ok: false, failure: "unavailable" });
    const { result } = await renderHook(() => usePracticeRun(newRun));
    await waitFor(() => expect(ready(result).failure).not.toBeNull());
    expect(ready(result).failure).toEqual({ source: "data", failure: "unavailable" });
    await act(async () => result.current.retry());
    await waitFor(() => expect(ready(result).phase).toBe("answering"));
    expect(fakeAi.practiceRound).toHaveBeenCalledTimes(1);
    expect(fakeData.addPracticeItems).toHaveBeenCalledTimes(2);
  });

  it("raises the target and asks again on keep going", async () => {
    withKey();
    fakeData.openPracticeRun.mockResolvedValue({
      ok: true,
      value: practiceTodayWith(
        [0, 1, 2, 3, 4].map((position) =>
          practiceItemWith({ id: `item-${position}`, position, correct: position !== 4 }),
        ),
      ),
    });
    const { result } = await renderHook(() => usePracticeRun({ kind: "resume", runId: "run-1" }));
    await waitFor(() => expect(ready(result).phase).toBe("result"));
    await act(async () => result.current.keepGoing());
    await waitFor(() => expect(ready(result).phase).toBe("answering"));
    expect(fakeData.setPracticeTarget).toHaveBeenCalledWith("run-1", 10);
    expect(fakeAi.practiceRound).toHaveBeenCalledTimes(1);
    expect(ready(result).run?.target).toBe(10);
  });

  it("finishes the run and goes Home", async () => {
    withKey();
    fakeData.openPracticeRun.mockResolvedValue({
      ok: true,
      value: practiceTodayWith(
        [0, 1, 2, 3, 4].map((position) =>
          practiceItemWith({ id: `item-${position}`, position, correct: position !== 4 }),
        ),
      ),
    });
    const { result } = await renderHook(() => usePracticeRun({ kind: "resume", runId: "run-1" }));
    await waitFor(() => expect(ready(result).phase).toBe("result"));
    await act(async () => result.current.finish());
    expect(fakeData.finishPracticeRun).toHaveBeenCalledWith("run-1");
    expect(router.dismissTo).toHaveBeenCalledWith("/");
  });

  it("goes Home without finishing again when the run is already finished", async () => {
    withKey();
    fakeData.openPracticeRun.mockResolvedValue({
      ok: true,
      value: practiceTodayWith(
        [0, 1, 2, 3, 4].map((position) =>
          practiceItemWith({ id: `item-${position}`, position, correct: true }),
        ),
        { finishedAt: "2026-11-05T11:00:00Z" },
      ),
    });
    const { result } = await renderHook(() => usePracticeRun({ kind: "resume", runId: "run-1" }));
    await waitFor(() => expect(ready(result).phase).toBe("result"));
    await act(async () => result.current.finish());
    expect(fakeData.finishPracticeRun).not.toHaveBeenCalled();
    expect(router.dismissTo).toHaveBeenCalledWith("/");
  });

  it("does not go Home when the finish cannot be saved", async () => {
    withKey();
    fakeData.openPracticeRun.mockResolvedValue({
      ok: true,
      value: practiceTodayWith(
        [0, 1, 2, 3, 4].map((position) =>
          practiceItemWith({ id: `item-${position}`, position, correct: position !== 4 }),
        ),
      ),
    });
    const { result } = await renderHook(() => usePracticeRun({ kind: "resume", runId: "run-1" }));
    await waitFor(() => expect(ready(result).phase).toBe("result"));
    fakeData.finishPracticeRun.mockResolvedValueOnce({ ok: false, failure: "network" });
    await act(async () => result.current.finish());
    expect(router.dismissTo).not.toHaveBeenCalled();
    expect(ready(result).failure).toEqual({ source: "data", failure: "network" });
  });

  it("stops and goes Home keeping the run", async () => {
    withKey();
    const { result } = await renderHook(() => usePracticeRun(newRun));
    await waitFor(() => expect(ready(result).phase).toBe("answering"));
    await act(async () => result.current.stop());
    expect(router.dismissTo).toHaveBeenCalledWith("/");
    expect(fakeData.finishPracticeRun).not.toHaveBeenCalled();
  });

  it("opens the key screen on update key", async () => {
    withKey();
    const { result } = await renderHook(() => usePracticeRun(newRun));
    await waitFor(() => expect(ready(result).phase).toBe("answering"));
    await act(async () => result.current.updateKey());
    expect(router.push).toHaveBeenCalledWith("/api-key");
  });

  it("does not ask while the spend is at the limit", async () => {
    withKey({ monthlyLimitUsd: 1 });
    fakeData.getMonthSpend.mockResolvedValue({
      ok: true,
      value: { monthStart: "2026-11-01", spentUsd: 1 },
    });
    const { result } = await renderHook(() => usePracticeRun(newRun));
    await waitFor(() => expect(ready(result).run).not.toBeNull());
    expect(fakeAi.practiceRound).not.toHaveBeenCalled();
    expect(ready(result).phase).toBe("asking");
  });

  it("re-reads the context when it regains focus and turns a gone key into no_key", async () => {
    withKey();
    const { result, rerender } = await renderHook(() => usePracticeRun(newRun));
    await waitFor(() => expect(ready(result).phase).toBe("answering"));
    fakeKeys.hasApiKey.mockResolvedValue({ ok: true, value: false });
    jest.mocked(useIsFocused).mockReturnValue(false);
    await rerender({});
    jest.mocked(useIsFocused).mockReturnValue(true);
    await rerender({});
    await waitFor(() => expect(result.current.view).toEqual({ kind: "no_key" }));
  });

  it("keeps the exercise and the spend when the context is read again", async () => {
    withKey();
    const { result, rerender } = await renderHook(() => usePracticeRun(newRun));
    await waitFor(() => expect(ready(result).phase).toBe("answering"));
    fakeData.getMonthSpend.mockResolvedValue({
      ok: true,
      value: { monthStart: "2026-11-01", spentUsd: 3 },
    });
    jest.mocked(useIsFocused).mockReturnValue(false);
    await rerender({});
    jest.mocked(useIsFocused).mockReturnValue(true);
    await rerender({});
    await waitFor(() => expect(ready(result).spentUsd).toBe(3));
    expect(ready(result).items).toHaveLength(5);
  });
});

describe("usePracticeRun with study notes", () => {
  beforeEach(() => {
    resetFakeData();
    resetFakeKeys();
    resetFakeAi();
    jest.mocked(useIsFocused).mockReturnValue(true);
    jest.mocked(router.push).mockClear();
    jest.mocked(router.dismissTo).mockClear();
  });

  const noteRun: PracticeOrigin = {
    kind: "new",
    input: { focus: "note", noteId: "note-1", target: 5 },
  };

  it("reads the note of a note run and sends it in the round call", async () => {
    withKey();
    const { result } = await renderHook(() => usePracticeRun(noteRun));
    await waitFor(() => expect(ready(result).phase).toBe("answering"));
    expect(fakeData.getNote).toHaveBeenCalledWith("note-1");
    expect(fakeData.createPracticeRun).toHaveBeenCalledWith({
      focus: "note",
      noteId: "note-1",
      target: 5,
    });
    const turn = fakeAi.practiceRound.mock.calls[0]?.[0].turns[0]?.text ?? "";
    const sent = JSON.parse(turn) as { focus: { kind: string; note: { title: string } } };
    expect(sent.focus.kind).toBe("note");
    expect(sent.focus.note.title).toBe("Future forms");
    expect(turn).toContain("going to");
    expect(turn).not.toContain("note-1");
  });

  it("reads the note of a resumed note run", async () => {
    withKey();
    fakeData.openPracticeRun.mockResolvedValue({
      ok: true,
      value: practiceTodayWith([practiceItemWith()], { focus: "note", noteId: "note-1" }),
    });
    const { result } = await renderHook(() => usePracticeRun({ kind: "resume", runId: "run-1" }));
    await waitFor(() => expect(ready(result).phase).toBe("answering"));
    expect(fakeData.getNote).toHaveBeenCalledWith("note-1");
  });

  it("fails when the note of a resumed run was deleted", async () => {
    withKey();
    fakeData.openPracticeRun.mockResolvedValue({
      ok: true,
      value: practiceTodayWith([practiceItemWith()], { focus: "note", noteId: null }),
    });
    const { result } = await renderHook(() => usePracticeRun({ kind: "resume", runId: "run-1" }));
    await waitFor(() =>
      expect(result.current.view).toEqual({ kind: "failed", message: practiceNoteGoneMessage }),
    );
    expect(fakeData.getNote).not.toHaveBeenCalled();
  });

  async function onMissSheet() {
    withKey();
    const hook = await renderHook(() => usePracticeRun(newRun));
    await waitFor(() => expect(ready(hook.result).phase).toBe("answering"));
    await act(async () => hook.result.current.pick("was"));
    await waitFor(() => expect(ready(hook.result).phase).toBe("feedback"));
    return hook.result;
  }

  it("makes a study note, saves it with no session, adds its usage to the run and opens it", async () => {
    const result = await onMissSheet();
    fakeData.addPracticeUsage.mockClear();
    const reply = studyNoteReplyWith();
    fakeAi.studyNote.mockResolvedValue({ ok: true, value: reply });
    await act(async () => result.current.makeNote());
    expect(fakeAi.studyNote).toHaveBeenCalledTimes(1);
    expect(fakeData.createNote).toHaveBeenCalledWith({ ...reply.note, sessionId: null });
    expect(fakeData.addPracticeUsage).toHaveBeenCalledWith("run-1", {
      model: reply.model,
      ...reply.usage,
    });
    expect(router.push).toHaveBeenCalledWith({ pathname: "/note", params: { id: "note-1" } });
    expect(ready(result).feedback?.tone).toBe("miss");
    expect(ready(result).openNote).toBeNull();
  });

  it("stays on the sheet when the note save fails", async () => {
    const result = await onMissSheet();
    fakeData.createNote.mockResolvedValue({ ok: false, failure: "network" });
    await act(async () => result.current.makeNote());
    expect(router.push).not.toHaveBeenCalled();
    expect(ready(result).failure).toMatchObject({ source: "data", failure: "network" });
    expect(ready(result).feedback).not.toBeNull();
  });

  it("stays on the sheet and shows the failure when the tutor fails", async () => {
    const result = await onMissSheet();
    fakeAi.studyNote.mockResolvedValue({ ok: false, failure: "rate_limited" });
    await act(async () => result.current.makeNote());
    expect(router.push).not.toHaveBeenCalled();
    expect(ready(result).failure).toMatchObject({ source: "ai", failure: "rate_limited" });
    expect(fakeData.createNote).not.toHaveBeenCalled();
  });

  it("saves the usage of a billed note failure", async () => {
    const result = await onMissSheet();
    fakeData.addPracticeUsage.mockClear();
    fakeAi.studyNote.mockResolvedValue({
      ok: false,
      failure: "bad_response",
      usage: studyNoteReplyWith().usage,
    });
    await act(async () => result.current.makeNote());
    expect(fakeData.addPracticeUsage).toHaveBeenCalledTimes(1);
    expect(router.push).not.toHaveBeenCalled();
  });
});
