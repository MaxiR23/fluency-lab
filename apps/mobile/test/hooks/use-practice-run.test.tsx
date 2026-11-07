// apps/mobile/test/hooks/use-practice-run.test.tsx
//
// Tests for the practice run hook.
//
// Tested:
// - The key, the profile, the spend, the run and the focus data read from their ports; no key and each failure
// - A new run is created, the first round is asked with the focus data only, and its items and usage are saved
// - A right pick and a typed match are answered with no tutor call; a typed miss asks the tutor
// - A billed AI failure saves its usage; an AI failure resends and a write failure resumes
// - Keep going, finish and stop; update key
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
import { practiceNotFoundMessage } from "@/utils/practice-run-state";
import type { PracticeOrigin } from "@/utils/practice-focus";
import {
  answerGradeWith,
  exerciseWith,
  fakeAi,
  practiceRoundWith,
  resetFakeAi,
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
      count: 5,
    });
    expect(request.system).not.toContain("Ada");
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
