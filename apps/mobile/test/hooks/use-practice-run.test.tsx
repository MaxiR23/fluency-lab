// apps/mobile/test/hooks/use-practice-run.test.tsx
//
// Tests for the practice run hook.
//
// Tested:
// - The key, the profile, the spend, the run and the focus data read from their ports; no key and each failure
// - A new run is created, the first exercise is written with the slot's target, kind and seed only, solved, and saved with its usage
// - The next exercise is written in the background while the first is on screen, and the checks of each slot are sent
// - A failed checks save does not block and is sent with the next save
// - A right pick and a typed match are answered with no tutor call; a typed miss asks the tutor
// - Every billed call saves its usage with its model
// - A billed AI failure saves its usage; after three failed attempts the slot switches kind, once every kind is used up the AI failure shows and Try again writes again; a write failure resumes
// - One chain at a time: a pick during a background call is saved by the same chain
// - A note run reads its note and sends it in the writer call; a missed exercise makes a study note, saves it with no session, adds its usage to the run and opens it, also while the background chain runs
// - Keep going, finish and stop; update key
// - Reads the recent prompts and rejects a written prompt that repeats one
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

import { TUTOR_MODEL } from "@fluency-lab/shared";

import { usePracticeRun } from "@/hooks/use-practice-run";
import { dataFailureMessage } from "@/utils/data-message";
import { practiceNoteGoneMessage, practiceNotFoundMessage } from "@/utils/practice-run-state";
import type { PracticeOrigin } from "@/utils/practice-focus";
import {
  answerGradeWith,
  exerciseDraftWith,
  exerciseFor,
  fakeAi,
  resetFakeAi,
  reviewWith,
  solutionWith,
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

const typedFix = (overrides: Parameters<typeof practiceItemWith>[0] = {}) =>
  practiceItemWith({
    id: "item-0",
    position: 0,
    kind: "fix",
    prompt: "I never been.",
    options: null,
    accepted: ["I've never been."],
    source: null,
    ...overrides,
  });

const resumeOrigin: PracticeOrigin = { kind: "resume", runId: "run-1" };

// INFO: a resumed run whose first item is a typed fix, so a typed answer can be graded.
function openTyped(item = typedFix()) {
  fakeData.openPracticeRun.mockResolvedValue({ ok: true, value: practiceTodayWith([item]) });
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
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

  it("is loading, then creates the run and writes, solves and saves the first exercise", async () => {
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
    expect(fakeAi.practiceExercise).toHaveBeenCalled();
    expect(fakeAi.solveExercise).toHaveBeenCalled();
    expect(fakeData.addPracticeItems).toHaveBeenCalledWith("run-1", [
      expect.objectContaining({ position: 0, kind: "choose" }),
    ]);
    expect(fakeData.addPracticeUsage).toHaveBeenCalledWith(
      "run-1",
      expect.objectContaining({ model: TUTOR_MODEL, inputTokens: 400, outputTokens: 150 }),
    );
    expect(fakeData.addPracticeUsage).toHaveBeenCalledWith(
      "run-1",
      expect.objectContaining({ model: TUTOR_MODEL, inputTokens: 150, outputTokens: 20 }),
    );
    expect(ready(result).items[0]?.position).toBe(0);
  });

  it("sends only the slot's target, kind and seed to the writer, no chat text", async () => {
    withKey();
    const { result } = await renderHook(() => usePracticeRun(newRun));
    await waitFor(() => expect(ready(result).phase).toBe("answering"));
    const [request] = fakeAi.practiceExercise.mock.calls[0];
    expect(request.turns).toHaveLength(1);
    expect(JSON.parse(request.turns[0].text)).toEqual({
      kind: "choose",
      target: {
        focus: "mistakes",
        correction: { original: "I have went", corrected: "I have gone", rule: "Present perfect" },
      },
      scenario: expect.any(String),
    });
    expect(request.system).not.toContain("Ada");
  });

  it("reads the recent prompts of the last seven days, forty at most", async () => {
    withKey();
    const { result } = await renderHook(() => usePracticeRun(newRun));
    await waitFor(() => expect(ready(result).phase).toBe("answering"));
    expect(fakeData.listRecentPrompts).toHaveBeenCalledWith(7, 40);
  });

  it("rejects a written prompt that repeats a recent one and sends no avoid list", async () => {
    withKey();
    const repeated = exerciseFor("choose", 7);
    fakeData.listRecentPrompts.mockResolvedValue({
      ok: true,
      value: [{ runId: "old-run", prompt: repeated.prompt, rule: "Present perfect" }],
    });
    fakeAi.practiceExercise.mockResolvedValueOnce({
      ok: true,
      value: exerciseDraftWith({ exercise: repeated }),
    });
    const { result } = await renderHook(() => usePracticeRun(newRun));
    await waitFor(() => expect(ready(result).phase).toBe("answering"));
    const [request] = fakeAi.practiceExercise.mock.calls[0];
    expect(JSON.parse(request.turns[0].text)).not.toHaveProperty("avoid");
    const rows = fakeData.addPracticeChecks.mock.calls.flatMap((call) => call[1]);
    expect(rows[0]).toMatchObject({ stage: "code", passed: false, reason: "repeat" });
  });

  it("shows the failure when the recent prompts cannot be read", async () => {
    withKey();
    fakeData.listRecentPrompts.mockResolvedValue({ ok: false, failure: "network" });
    const { result } = await renderHook(() => usePracticeRun(newRun));
    await waitFor(() => expect(result.current.view.kind).toBe("failed"));
    expect(fakeAi.practiceExercise).not.toHaveBeenCalled();
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
    expect(fakeAi.practiceExercise).not.toHaveBeenCalled();
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

  it("fails when the run cannot be created and retries without writing twice", async () => {
    withKey();
    fakeData.createPracticeRun.mockResolvedValueOnce({ ok: false, failure: "network" });
    const { result } = await renderHook(() => usePracticeRun(newRun));
    await waitFor(() =>
      expect(ready(result).failure).toEqual({ source: "data", failure: "network" }),
    );
    expect(fakeAi.practiceExercise).not.toHaveBeenCalled();
    await act(async () => result.current.retry());
    await waitFor(() => expect(ready(result).phase).toBe("answering"));
    expect(fakeData.createPracticeRun).toHaveBeenCalledTimes(2);
    expect(fakeAi.practiceExercise).toHaveBeenCalled();
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
    expect(fakeAi.practiceExercise).not.toHaveBeenCalled();
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
    openTyped();
    const { result } = await renderHook(() => usePracticeRun(resumeOrigin));
    await waitFor(() => expect(ready(result).phase).toBe("answering"));
    await act(async () => result.current.setDraft("i've never been"));
    await act(async () => result.current.check());
    await waitFor(() => expect(ready(result).phase).toBe("feedback"));
    expect(fakeAi.gradeAnswer).not.toHaveBeenCalled();
    expect(ready(result).feedback?.tone).toBe("right");
  });

  it("answers a gap typed as the whole sentence with no tutor call", async () => {
    withKey();
    openTyped(
      typedFix({
        kind: "gap",
        prompt: "I ___ (not / can) remember who made the shot!",
        accepted: ["can't"],
      }),
    );
    const { result } = await renderHook(() => usePracticeRun(resumeOrigin));
    await waitFor(() => expect(ready(result).phase).toBe("answering"));
    await act(async () => result.current.setDraft("I can't remember who made the shot."));
    await act(async () => result.current.check());
    await waitFor(() => expect(ready(result).phase).toBe("feedback"));
    expect(fakeAi.gradeAnswer).not.toHaveBeenCalled();
    expect(ready(result).feedback?.tone).toBe("right");
  });

  it("saves a flawed exercise as correct and records a grader check that failed", async () => {
    withKey();
    openTyped();
    fakeAi.gradeAnswer.mockResolvedValue({
      ok: true,
      value: answerGradeWith({ correct: false, flawed: true, explanation: "Two answers fit." }),
    });
    const { result } = await renderHook(() => usePracticeRun(resumeOrigin));
    await waitFor(() => expect(ready(result).phase).toBe("answering"));
    await act(async () => result.current.setDraft("I never was."));
    await act(async () => result.current.check());
    await waitFor(() => expect(ready(result).phase).toBe("feedback"));
    expect(fakeData.answerPracticeItem).toHaveBeenCalledWith(
      "item-0",
      expect.objectContaining({ correct: true }),
    );
    await waitFor(() =>
      expect(fakeData.addPracticeChecks).toHaveBeenCalledWith(
        "run-1",
        expect.arrayContaining([
          expect.objectContaining({ stage: "grader", passed: false, reason: "grader_flawed" }),
        ]),
      ),
    );
  });

  it("asks the tutor for a typed miss and saves the answer and its usage", async () => {
    withKey();
    openTyped();
    const grade = answerGradeWith({ correct: false, explanation: "Needs have." });
    fakeAi.gradeAnswer.mockResolvedValue({ ok: true, value: grade });
    const { result } = await renderHook(() => usePracticeRun(resumeOrigin));
    await waitFor(() => expect(ready(result).phase).toBe("answering"));
    await act(async () => result.current.setDraft("I never was."));
    await act(async () => result.current.check());
    await waitFor(() => expect(ready(result).phase).toBe("feedback"));
    expect(fakeAi.gradeAnswer).toHaveBeenCalledTimes(1);
    expect(ready(result).feedback).toMatchObject({ tone: "miss", explanation: "Needs have." });
    expect(fakeData.answerPracticeItem).toHaveBeenCalledWith("item-0", {
      userAnswer: "I never was.",
      correct: false,
    });
    await waitFor(() =>
      expect(fakeData.addPracticeUsage).toHaveBeenCalledWith("run-1", {
        model: grade.model,
        ...grade.usage,
      }),
    );
  });

  it("saves the usage of the writer, solver, reviewer and grader with their model", async () => {
    withKey();
    fakeData.openPracticeRun.mockResolvedValue({
      ok: true,
      value: practiceTodayWith([
        typedFix(),
        practiceItemWith({ id: "item-1", position: 1, correct: true }),
      ]),
    });
    const grade = answerGradeWith({ correct: false });
    fakeAi.gradeAnswer.mockResolvedValue({ ok: true, value: grade });
    const { result } = await renderHook(() => usePracticeRun(resumeOrigin));
    await waitFor(() => expect(fakeAi.reviewExercise).toHaveBeenCalled());
    await act(async () => result.current.setDraft("I never was."));
    await act(async () => result.current.check());
    await waitFor(() => expect(ready(result).phase).toBe("feedback"));
    const draft = exerciseDraftWith();
    const solution = solutionWith();
    const review = reviewWith();
    await waitFor(() => {
      for (const call of [draft, solution, review, grade]) {
        expect(fakeData.addPracticeUsage).toHaveBeenCalledWith("run-1", {
          model: call.model,
          ...call.usage,
        });
      }
    });
  });

  it("writes the next exercise in the background while the first is on screen", async () => {
    withKey();
    const { result } = await renderHook(() => usePracticeRun(newRun));
    await waitFor(() => expect(ready(result).items).toHaveLength(2));
    expect(ready(result).phase).toBe("answering");
    expect(ready(result).items.map((entry) => entry.position)).toEqual([0, 1]);
    expect(fakeAi.practiceExercise).toHaveBeenCalledTimes(2);
  });

  it("sends the checks of each slot to addPracticeChecks", async () => {
    withKey();
    const { result } = await renderHook(() => usePracticeRun(newRun));
    await waitFor(() => expect(ready(result).items).toHaveLength(2));
    await waitFor(() => expect(fakeData.addPracticeChecks).toHaveBeenCalled());
    const rows = fakeData.addPracticeChecks.mock.calls.flatMap(([, checks]) => checks);
    expect(rows.map((row) => row.stage)).toEqual([
      "code",
      "solver",
      "reviewer",
      "code",
      "solver",
      "reviewer",
    ]);
    expect(fakeData.addPracticeChecks.mock.calls[0]?.[0]).toBe("run-1");
  });

  it("goes on when the checks save fails and sends them with the next save", async () => {
    withKey();
    fakeData.addPracticeChecks.mockResolvedValueOnce({ ok: false, failure: "network" });
    const { result } = await renderHook(() => usePracticeRun(newRun));
    await waitFor(() => expect(ready(result).items).toHaveLength(2));
    await waitFor(() => expect(fakeData.addPracticeChecks).toHaveBeenCalledTimes(2));
    expect(ready(result).failure).toBeNull();
    expect(fakeData.addPracticeChecks.mock.calls[0]?.[1]).toHaveLength(3);
    expect(fakeData.addPracticeChecks.mock.calls[1]?.[1]).toHaveLength(6);
  });

  it("saves the usage of a billed failure and shows the AI failure once every kind is used up", async () => {
    withKey();
    const usage = exerciseDraftWith().usage;
    fakeAi.practiceExercise.mockResolvedValue({ ok: false, failure: "bad_response", usage });
    const { result } = await renderHook(() => usePracticeRun(newRun));
    await waitFor(() => expect(ready(result).failure).not.toBeNull());
    expect(fakeAi.practiceExercise).toHaveBeenCalledTimes(18);
    await waitFor(() => expect(fakeData.addPracticeUsage).toHaveBeenCalledTimes(18));
    expect(ready(result).failure).toMatchObject({ source: "ai", failure: "bad_response" });
    expect(ready(result).phase).toBe("asking");
  });

  it("shows the AI failure once every kind is used up and writes again on Try again", async () => {
    withKey();
    for (let i = 0; i < 18; i += 1) {
      fakeAi.practiceExercise.mockResolvedValueOnce({ ok: false, failure: "bad_response" });
    }
    const { result } = await renderHook(() => usePracticeRun(newRun));
    await waitFor(() => expect(ready(result).failure).not.toBeNull());
    expect(fakeAi.practiceExercise).toHaveBeenCalledTimes(18);
    await act(async () => result.current.retry());
    await waitFor(() => expect(ready(result).phase).toBe("answering"));
    expect(ready(result).failure).toBeNull();
  });

  it("writes the exercise again on retry after a network failure", async () => {
    withKey();
    fakeAi.practiceExercise.mockResolvedValueOnce({ ok: false, failure: "network" });
    const { result } = await renderHook(() => usePracticeRun(newRun));
    await waitFor(() => expect(ready(result).failure).not.toBeNull());
    expect(fakeData.addPracticeUsage).not.toHaveBeenCalled();
    await act(async () => result.current.retry());
    await waitFor(() => expect(ready(result).phase).toBe("answering"));
    expect(fakeAi.practiceExercise).toHaveBeenCalledTimes(3);
  });

  it("resumes at the failed write without writing the exercise again", async () => {
    withKey();
    fakeData.addPracticeItems.mockResolvedValueOnce({ ok: false, failure: "unavailable" });
    const { result } = await renderHook(() => usePracticeRun(newRun));
    await waitFor(() => expect(ready(result).failure).not.toBeNull());
    expect(ready(result).failure).toEqual({ source: "data", failure: "unavailable" });
    const written = fakeAi.practiceExercise.mock.calls.length;
    await act(async () => result.current.retry());
    await waitFor(() => expect(ready(result).phase).toBe("answering"));
    expect(fakeAi.practiceExercise.mock.calls.length).toBeGreaterThanOrEqual(written);
    expect(fakeData.addPracticeItems.mock.calls[0]?.[1]).toEqual(
      fakeData.addPracticeItems.mock.calls[1]?.[1],
    );
  });

  it("runs one chain at a time: a pick during a background call is saved by the same chain", async () => {
    withKey();
    const second = deferred<Awaited<ReturnType<typeof fakeAi.practiceExercise>>>();
    let calls = 0;
    let running = 0;
    let overlapped = false;
    const original = fakeAi.practiceExercise.getMockImplementation();
    fakeAi.practiceExercise.mockImplementation(async (request) => {
      calls += 1;
      running += 1;
      overlapped = overlapped || running > 1;
      try {
        if (calls === 2) return await second.promise;
        return original === undefined ? { ok: false, failure: "network" } : await original(request);
      } finally {
        running -= 1;
      }
    });
    const { result } = await renderHook(() => usePracticeRun(newRun));
    await waitFor(() => expect(ready(result).phase).toBe("answering"));
    await waitFor(() => expect(calls).toBe(2));
    let picked: Promise<void> = Promise.resolve();
    await act(async () => {
      picked = result.current.pick("have been");
    });
    expect(ready(result).feedback?.tone).toBe("right");
    expect(fakeData.answerPracticeItem).not.toHaveBeenCalled();
    const next =
      original === undefined ? null : await original(fakeAi.practiceExercise.mock.calls[1][0]);
    await act(async () => {
      second.resolve(next ?? { ok: false, failure: "network" });
      await picked;
    });
    expect(fakeData.answerPracticeItem).toHaveBeenCalledWith("item-0", {
      userAnswer: "have been",
      correct: true,
    });
    expect(overlapped).toBe(false);
  });

  async function holdSecondWrite() {
    withKey();
    const second = deferred<Awaited<ReturnType<typeof fakeAi.practiceExercise>>>();
    let calls = 0;
    const original = fakeAi.practiceExercise.getMockImplementation();
    fakeAi.practiceExercise.mockImplementation(async (request) => {
      calls += 1;
      if (calls === 2) return await second.promise;
      return original === undefined ? { ok: false, failure: "network" } : await original(request);
    });
    return { second, original, count: () => calls };
  }

  it("starts no new AI call after Stop practice, and still saves the call in flight", async () => {
    const setup = await holdSecondWrite();
    const { result } = await renderHook(() => usePracticeRun(newRun));
    await waitFor(() => expect(setup.count()).toBe(2));
    const solves = fakeAi.solveExercise.mock.calls.length;
    const usages = fakeData.addPracticeUsage.mock.calls.length;
    await act(async () => result.current.stop());
    const next =
      setup.original === undefined
        ? null
        : await setup.original(fakeAi.practiceExercise.mock.calls[1][0]);
    await act(async () => {
      setup.second.resolve(next ?? { ok: false, failure: "network" });
    });
    await waitFor(() => expect(fakeData.addPracticeUsage.mock.calls.length).toBe(usages + 1));
    expect(fakeAi.solveExercise.mock.calls.length).toBe(solves);
    expect(fakeAi.practiceExercise.mock.calls.length).toBe(2);
    expect(router.dismissTo).toHaveBeenCalledWith("/");
  });

  it("starts no new AI call after the screen unmounts", async () => {
    const setup = await holdSecondWrite();
    const { result, unmount } = await renderHook(() => usePracticeRun(newRun));
    await waitFor(() => expect(setup.count()).toBe(2));
    const solves = fakeAi.solveExercise.mock.calls.length;
    const usages = fakeData.addPracticeUsage.mock.calls.length;
    expect(result.current.view.kind).toBe("ready");
    await unmount();
    const next =
      setup.original === undefined
        ? null
        : await setup.original(fakeAi.practiceExercise.mock.calls[1][0]);
    await act(async () => {
      setup.second.resolve(next ?? { ok: false, failure: "network" });
    });
    await waitFor(() => expect(fakeData.addPracticeUsage.mock.calls.length).toBe(usages + 1));
    expect(fakeAi.solveExercise.mock.calls.length).toBe(solves);
  });

  it("raises the target and writes the next exercise on keep going", async () => {
    withKey();
    fakeData.openPracticeRun.mockResolvedValue({
      ok: true,
      value: practiceTodayWith(
        [0, 1, 2, 3, 4].map((position) =>
          practiceItemWith({ id: `item-${position}`, position, correct: position !== 4 }),
        ),
      ),
    });
    const { result } = await renderHook(() => usePracticeRun(resumeOrigin));
    await waitFor(() => expect(ready(result).phase).toBe("result"));
    await act(async () => result.current.keepGoing());
    await waitFor(() => expect(ready(result).phase).toBe("answering"));
    expect(fakeData.setPracticeTarget).toHaveBeenCalledWith("run-1", 10);
    expect(fakeAi.practiceExercise).toHaveBeenCalled();
    expect(ready(result).run?.target).toBe(10);
    expect(ready(result).items.at(-1)?.position).toBeGreaterThanOrEqual(5);
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
    expect(fakeAi.practiceExercise).not.toHaveBeenCalled();
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
    expect(ready(result).items.length).toBeGreaterThan(0);
  });

  it("finishes after the chain in flight and goes Home", async () => {
    withKey();
    fakeData.openPracticeRun.mockResolvedValue({
      ok: true,
      value: practiceTodayWith([
        ...[0, 1, 2, 3].map((position) =>
          practiceItemWith({ id: `item-${position}`, position, correct: true }),
        ),
        typedFix({ id: "item-4", position: 4 }),
      ]),
    });
    fakeAi.gradeAnswer.mockResolvedValue({
      ok: true,
      value: answerGradeWith({ correct: false }),
    });
    const checks = deferred<Awaited<ReturnType<typeof fakeData.addPracticeChecks>>>();
    fakeData.addPracticeChecks.mockReturnValue(checks.promise);
    const { result } = await renderHook(() => usePracticeRun(resumeOrigin));
    await waitFor(() => expect(ready(result).phase).toBe("answering"));
    await act(async () => result.current.setDraft("I never was."));
    // INFO: the calls below wait on the chain that waits on the checks save, so none is awaited here.
    const pending: Promise<void>[] = [];
    await act(async () => {
      pending.push(result.current.check());
    });
    await waitFor(() => expect(fakeData.addPracticeChecks).toHaveBeenCalled());
    await act(async () => {
      pending.push(result.current.next());
    });
    expect(ready(result).phase).toBe("result");
    await act(async () => {
      pending.push(result.current.finish());
    });
    expect(fakeData.finishPracticeRun).not.toHaveBeenCalled();
    await act(async () => {
      checks.resolve({ ok: true, value: { count: 1 } });
      await Promise.all(pending);
    });
    expect(fakeData.finishPracticeRun).toHaveBeenCalledWith("run-1");
    expect(router.dismissTo).toHaveBeenCalledWith("/");
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

  it("reads the note of a note run and sends it in the writer call", async () => {
    withKey();
    const { result } = await renderHook(() => usePracticeRun(noteRun));
    await waitFor(() => expect(ready(result).phase).toBe("answering"));
    expect(fakeData.getNote).toHaveBeenCalledWith("note-1");
    expect(fakeData.createPracticeRun).toHaveBeenCalledWith({
      focus: "note",
      noteId: "note-1",
      target: 5,
    });
    const turn = fakeAi.practiceExercise.mock.calls[0]?.[0].turns[0]?.text ?? "";
    const sent = JSON.parse(turn) as { target: { focus: string; note: { title: string } } };
    expect(sent.target.focus).toBe("note");
    expect(sent.target.note.title).toBe("Future forms");
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

  it("opens a saved study note even while the background chain is running", async () => {
    withKey();
    fakeData.openPracticeRun.mockResolvedValue({
      ok: true,
      value: practiceTodayWith([practiceItemWith({ id: "item-0" })]),
    });
    const third = deferred<Awaited<ReturnType<typeof fakeAi.practiceExercise>>>();
    const original = fakeAi.practiceExercise.getMockImplementation();
    let calls = 0;
    fakeAi.practiceExercise.mockImplementation(async (request) => {
      calls += 1;
      if (calls === 2) return await third.promise;
      return original === undefined ? { ok: false, failure: "network" } : await original(request);
    });
    const { result } = await renderHook(() => usePracticeRun(resumeOrigin));
    await waitFor(() => expect(calls).toBe(1));
    await waitFor(() => expect(ready(result).items).toHaveLength(2));
    const pending: Promise<void>[] = [];
    await act(async () => {
      pending.push(result.current.pick("was"));
    });
    await waitFor(() => expect(calls).toBe(2));
    await waitFor(() => expect(ready(result).phase).toBe("feedback"));
    expect(fakeData.answerPracticeItem).toHaveBeenCalled();
    await act(async () => {
      pending.push(result.current.makeNote());
      third.resolve(
        original === undefined
          ? { ok: false, failure: "network" }
          : await original(fakeAi.practiceExercise.mock.calls[1][0]),
      );
      await Promise.all(pending);
    });
    expect(router.push).toHaveBeenCalledWith({ pathname: "/note", params: { id: "note-1" } });
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
