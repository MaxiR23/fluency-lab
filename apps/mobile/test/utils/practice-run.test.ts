// apps/mobile/test/utils/practice-run.test.ts
//
// Tests for the state machine of a practice run.
//
// Tested:
// - startPractice: a new run starts by creating the run; a resumed run settles on its items
// - practiceReducer and practiceStep: the order of the outside calls of a round and of an answer
// - A gap answered with the whole sentence is right locally; a flawed grade is saved correct and never escalates
// - A right pick and a typed match are answered without a tutor call; a typed miss asks the tutor
// - The cost of every billed call, also of an unusable reply, is added and saved
// - The offer of five more, keep going, the end of the run and the spend lock
// - Failures: an AI failure resends, a save failure resumes at the failed write
// - segments, fillIndex, currentItem, exerciseView, gapFill and runOutcome
// - The study note of a missed exercise: asked, saved with no session, opened, its usage and its failures
// - runBody, progressPosition and optionState: what the screen draws, decided outside it
//
// What is covered:
// - Normal case, empty case, edges
//
// Run with: pnpm exec jest apps/mobile/test/utils/practice-run.test.ts
//
// SEE: apps/mobile/src/utils/practice-run.ts

import { describe, expect, it } from "@jest/globals";
import { TUTOR_MODEL, usageCostUsd, type PracticeRunWithItems } from "@fluency-lab/shared";

import type { PracticeRound } from "@/ai/ai-port";
import { sendState } from "@/utils/chat-conversation";
import { missedRules } from "@/utils/practice-escalation";
import {
  currentItem,
  exerciseView,
  fillIndex,
  gapFill,
  continueBusy,
  noteAction,
  optionState,
  practiceReducer,
  practiceRetryKind,
  practiceStep,
  progressPosition,
  runBody,
  runOutcome,
  segments,
  startPractice,
  type PracticeEvent,
  type PracticeRunState,
} from "@/utils/practice-run";
import {
  gradeRequest,
  roundRequest,
  studyNoteRequest,
  type FocusData,
} from "@/utils/practice-prompt";
import {
  completedProfile,
  practiceItemWith,
  practiceRunWith,
  practiceTodayWith,
} from "../helpers/fake-data";
import {
  answerGradeWith,
  exerciseWith,
  practiceRoundWith,
  studyNoteReplyWith,
} from "../helpers/fake-ai";

const focus: FocusData = {
  kind: "mistakes",
  corrections: [{ original: "I has", corrected: "I have", rule: "Verbs" }],
};
const profile = {
  ...completedProfile(),
  displayName: "Maxi",
  provider: "claude" as const,
  monthlyLimitUsd: 10,
};

function fresh(
  overrides: Partial<{ spentUsd: number; limit: number | null; language: string | null }> = {},
) {
  return startPractice({
    origin: { kind: "new", input: { focus: "mistakes", target: 5 } },
    opened: null,
    profile: {
      ...profile,
      monthlyLimitUsd: overrides.limit === undefined ? 10 : overrides.limit,
    },
    spentUsd: overrides.spentUsd ?? 0,
    focus,
    language: overrides.language ?? null,
  });
}

function resumed(opened: PracticeRunWithItems, spentUsd = 0) {
  return startPractice({
    origin: { kind: "resume", runId: opened.run.id },
    opened,
    profile,
    spentUsd,
    focus,
    language: null,
  });
}

function apply(state: PracticeRunState, ...events: PracticeEvent[]) {
  return events.reduce(practiceReducer, state);
}

const item = (position: number, correct: boolean | null = null, overrides = {}) =>
  practiceItemWith({
    id: `item-${position}`,
    position,
    correct,
    userAnswer: correct === null ? null : "x",
    ...overrides,
  });

const typedItem = (position: number, correct: boolean | null = null) =>
  item(position, correct, {
    kind: "fix",
    prompt: "I never been to Japan.",
    options: null,
    accepted: ["I've never been to Japan."],
    source: "I never been to Japan.",
  });

// INFO: a run that has just saved its first round of five choose exercises.
function answering(items = [0, 1, 2, 3, 4].map((p) => item(p)), target: 5 | 10 | 15 = 5) {
  return resumed(practiceTodayWith(items, { target }));
}

const round = (count: number): PracticeRound =>
  practiceRoundWith({
    items: Array.from({ length: count }, (_, i) => exerciseWith({ prompt: `Q${i} ___` })),
  });

describe("startPractice", () => {
  it("starts by creating the run", () => {
    const state = fresh();
    expect(state.phase).toBe("creating");
    expect(practiceStep(state)).toEqual({
      kind: "write",
      write: { kind: "create", input: { focus: "mistakes", target: 5 } },
    });
  });

  it("asks the first round after the run is created", () => {
    const state = apply(fresh(), { type: "write_done", run: practiceRunWith() });
    expect(state.phase).toBe("asking");
    expect(state.run?.id).toBe("run-1");
    expect(practiceStep(state)).toEqual({
      kind: "round",
      request: roundRequest({ focus, count: 5, missedRules: [], language: null }),
      count: 5,
    });
  });

  it("asks the round step for the count the round needs", () => {
    const state = resumed(
      practiceTodayWith([item(0, true), item(1, true), item(2, true)], { target: 5 }),
    );
    const step = practiceStep(state);
    expect(step).toEqual({
      kind: "round",
      request: roundRequest({ focus, count: 2, missedRules: [], language: null }),
      count: 2,
    });
    expect(
      JSON.parse(step.kind === "round" ? (step.request.turns[0]?.text ?? "{}") : "{}").count,
    ).toBe(4);
  });

  it("settles a resumed run on its first unanswered item", () => {
    const state = answering();
    expect(state.phase).toBe("answering");
    expect(currentItem(state)?.id).toBe("item-0");
  });

  it("settles a resumed run with no items on asking the round again", () => {
    const state = resumed(practiceTodayWith([]));
    expect(state.phase).toBe("asking");
  });

  it("settles a resumed run with all answered but short of the target on asking", () => {
    expect(resumed(practiceTodayWith([item(0, true), item(1, true)])).phase).toBe("asking");
  });

  it("settles a resumed run at its target with a miss on the offer", () => {
    const state = resumed(
      practiceTodayWith([0, 1, 2, 3].map((p) => item(p, true)).concat(item(4, false))),
    );
    expect(state.phase).toBe("result");
    expect(runOutcome(state)).toBe("offer");
    expect(practiceStep(state)).toEqual({ kind: "none" });
  });

  it("finishes a resumed run with no miss as soon as the result shows", () => {
    const state = resumed(practiceTodayWith([0, 1, 2, 3, 4].map((p) => item(p, true))));
    expect(state.phase).toBe("finishing");
    expect(practiceStep(state)).toEqual({ kind: "write", write: { kind: "finish" } });
    const done = apply(state, {
      type: "write_done",
      run: practiceRunWith({ finishedAt: "2026-11-05T11:00:00Z" }),
    });
    expect(done.phase).toBe("result");
    expect(runOutcome(done)).toBe("finished");
  });

  it("shows a finished run's result without a write", () => {
    const state = resumed(
      practiceTodayWith(
        [0, 1, 2, 3, 4].map((p) => item(p, false)),
        {
          finishedAt: "2026-11-05T11:00:00Z",
        },
      ),
    );
    expect(state.phase).toBe("result");
    expect(practiceStep(state)).toEqual({ kind: "none" });
  });
});

describe("a round", () => {
  const asking = apply(fresh(), { type: "write_done", run: practiceRunWith() });

  it("saves the items, then the usage", () => {
    const received = apply(asking, { type: "round_received", round: practiceRoundWith() });
    expect(received.phase).toBe("saving");
    expect(received.writes.map((w) => w.kind)).toEqual(["items", "usage"]);
    const first = received.writes[0];
    expect(first?.kind === "items" && first.items.map((i) => i.position)).toEqual([0, 1, 2, 3, 4]);
    expect(practiceStep(received)).toEqual({ kind: "write", write: received.writes[0] });
  });

  it("adds the round's cost to the spend", () => {
    const value = practiceRoundWith();
    const received = apply(asking, { type: "round_received", round: value });
    expect(received.spentUsd).toBeCloseTo(usageCostUsd(value.model, value.usage), 8);
    expect(received.writes[1]).toEqual({
      kind: "usage",
      usage: { model: TUTOR_MODEL, ...value.usage },
    });
  });

  it("keeps at most the exercises it asked for", () => {
    const received = apply(asking, { type: "round_received", round: round(7) });
    const first = received.writes[0];
    expect(first?.kind === "items" && first.items).toHaveLength(5);
  });

  it("shows the saved items and answers the first one after the writes", () => {
    const received = apply(asking, { type: "round_received", round: practiceRoundWith() });
    const saved = [0, 1, 2, 3, 4].map((p) => item(p));
    const midway = apply(received, { type: "write_done", items: saved });
    expect(midway.phase).toBe("saving");
    expect(midway.items).toHaveLength(5);
    const done = apply(midway, { type: "write_done" });
    expect(done.phase).toBe("answering");
    expect(currentItem(done)?.id).toBe("item-0");
  });

  it("asks the next round with the missed rules first", () => {
    const state = resumed(practiceTodayWith([item(0, false, { rule: "Articles" })], { target: 5 }));
    expect(state.phase).toBe("asking");
    expect(practiceStep(state)).toEqual({
      kind: "round",
      request: roundRequest({ focus, count: 4, missedRules: ["Articles"], language: null }),
      count: 4,
    });
  });

  it("asks for translate in the device language", () => {
    const state = startPractice({
      origin: { kind: "new", input: { focus: "mistakes", target: 5 } },
      opened: null,
      profile,
      spentUsd: 0,
      focus,
      language: "es-AR",
    });
    const next = apply(state, { type: "write_done", run: practiceRunWith() });
    expect(practiceStep(next)).toEqual({
      kind: "round",
      request: roundRequest({ focus, count: 5, missedRules: [], language: "es-AR" }),
      count: 5,
    });
  });

  it("saves the cost of a billed failure and stays on asking", () => {
    const usage = practiceRoundWith().usage;
    const failed = apply(asking, {
      type: "round_failed",
      failure: { source: "ai", failure: "bad_response" },
      usage,
    });
    expect(failed.writes).toEqual([{ kind: "usage", usage: { model: TUTOR_MODEL, ...usage } }]);
    expect(failed.spentUsd).toBeGreaterThan(0);
    expect(failed.phase).toBe("saving");
    const done = apply(failed, { type: "write_done" });
    expect(done.phase).toBe("asking");
    expect(done.failure).toEqual({ source: "ai", failure: "bad_response" });
    expect(practiceStep(done)).toEqual({ kind: "none" });
  });

  it("fails without a write when the failure was not billed", () => {
    const failed = apply(asking, {
      type: "round_failed",
      failure: { source: "ai", failure: "network" },
    });
    expect(failed.writes).toEqual([]);
    expect(failed.phase).toBe("asking");
    expect(practiceStep(failed)).toEqual({ kind: "none" });
  });

  it("resends after an AI failure and resumes after a write failure", () => {
    const aiFailed = apply(asking, {
      type: "round_failed",
      failure: { source: "ai", failure: "network" },
    });
    expect(practiceRetryKind(aiFailed)).toBe("resend");
    const retried = apply(aiFailed, { type: "retry" });
    expect(retried.failure).toBeNull();
    expect(practiceStep(retried).kind).toBe("round");

    const received = apply(asking, { type: "round_received", round: practiceRoundWith() });
    const writeFailed = apply(received, {
      type: "write_failed",
      failure: { source: "data", failure: "network" },
    });
    expect(practiceRetryKind(writeFailed)).toBe("resume");
    const resumedState = apply(writeFailed, { type: "retry" });
    expect(resumedState.failure).toBeNull();
    expect(practiceStep(resumedState)).toEqual({ kind: "write", write: received.writes[0] });
  });
});

describe("answering", () => {
  it("answers a right pick without a tutor call and queues the answer", () => {
    const state = apply(answering(), { type: "picked", option: "have been" });
    expect(state.feedback).toMatchObject({ tone: "right", title: "Nice one!", answer: null });
    expect(state.items[0]).toMatchObject({ correct: true, userAnswer: "have been" });
    expect(state.phase).toBe("saving");
    expect(practiceStep(state)).toEqual({
      kind: "write",
      write: {
        kind: "answer",
        itemId: "item-0",
        answer: { userAnswer: "have been", correct: true },
      },
    });
  });

  it("raises Not quite on a wrong pick with the answer and the item's explanation", () => {
    const state = apply(answering(), { type: "picked", option: "was" });
    expect(state.feedback).toMatchObject({
      tone: "miss",
      title: "Not quite",
      answer: "have been",
      explanation: "Use the present perfect for an experience.",
    });
    expect(state.items[0]?.correct).toBe(false);
    expect(state.picked).toBe("was");
  });

  it("ignores a pick that is not one of the options and a second pick", () => {
    const start = answering();
    expect(apply(start, { type: "picked", option: "were" })).toBe(start);
    const picked = apply(start, { type: "picked", option: "was" });
    expect(apply(picked, { type: "picked", option: "have been" })).toBe(picked);
  });

  it("shows the feedback until Continue and then the next item", () => {
    const picked = apply(answering(), { type: "picked", option: "have been" });
    const saved = apply(picked, { type: "write_done" });
    expect(saved.phase).toBe("feedback");
    expect(saved.feedback).not.toBeNull();
    const next = apply(saved, { type: "continue" });
    expect(next.phase).toBe("answering");
    expect(next.feedback).toBeNull();
    expect(next.picked).toBeNull();
    expect(currentItem(next)?.id).toBe("item-1");
  });

  it("ignores Continue while the answer is still saving", () => {
    const picked = apply(answering(), { type: "picked", option: "have been" });
    expect(apply(picked, { type: "continue" })).toBe(picked);
  });

  it("answers a typed answer that matches without a tutor call", () => {
    const state = apply(
      answering([typedItem(0), typedItem(1), typedItem(2), typedItem(3), typedItem(4)]),
      { type: "draft_changed", text: "  i've never been to japan " },
      { type: "check_started" },
    );
    expect(state.phase).toBe("saving");
    expect(state.feedback?.tone).toBe("right");
    expect(practiceStep(state).kind).toBe("write");
  });

  it("asks the tutor for a typed answer that does not match", () => {
    const state = apply(
      answering([typedItem(0), typedItem(1), typedItem(2), typedItem(3), typedItem(4)]),
      { type: "draft_changed", text: "I have never visited Japan." },
      { type: "check_started" },
    );
    expect(state.phase).toBe("grading");
    expect(practiceStep(state)).toEqual({
      kind: "grade",
      request: gradeRequest(
        {
          kind: "fix",
          rule: "Present perfect",
          prompt: "I never been to Japan.",
          accepted: ["I've never been to Japan."],
        },
        "I have never visited Japan.",
      ),
    });
  });

  describe("a gap answered with the whole sentence", () => {
    const sentenceGaps = () =>
      answering(
        [0, 1, 2, 3, 4].map((p) =>
          item(p, null, {
            kind: "gap",
            options: null,
            prompt: "I ___ (not / can) remember who made the shot!",
            accepted: ["can't"],
          }),
        ),
      );

    it("is right without a tutor call when the fill is right", () => {
      const state = apply(
        sentenceGaps(),
        { type: "draft_changed", text: "I can't remember who made the shot." },
        { type: "check_started" },
      );
      expect(state.phase).toBe("saving");
      expect(state.feedback?.tone).toBe("right");
      expect(state.writes.map((w) => w.kind)).toEqual(["answer"]);
      expect(state.items[0]?.correct).toBe(true);
    });

    it("asks the tutor with a wrong fill", () => {
      const state = apply(
        sentenceGaps(),
        { type: "draft_changed", text: "I can remember who made the shot." },
        { type: "check_started" },
      );
      expect(state.phase).toBe("grading");
    });
  });

  it("does nothing on Check with an empty answer", () => {
    const start = answering([typedItem(0), typedItem(1), typedItem(2), typedItem(3), typedItem(4)]);
    expect(apply(start, { type: "check_started" })).toBe(start);
    expect(
      apply(start, { type: "draft_changed", text: "  " }, { type: "check_started" }).phase,
    ).toBe("answering");
  });

  it("raises feedback with the grading explanation on a miss and saves its cost", () => {
    const grading = apply(
      answering([typedItem(0), typedItem(1), typedItem(2), typedItem(3), typedItem(4)]),
      { type: "draft_changed", text: "I never was to Japan." },
      { type: "check_started" },
    );
    const grade = answerGradeWith({ correct: false, explanation: "Never was is not natural." });
    const state = apply(grading, { type: "grade_received", grade });
    expect(state.feedback).toMatchObject({
      tone: "miss",
      answer: "I've never been to Japan.",
      explanation: "Never was is not natural.",
    });
    expect(state.writes.map((w) => w.kind)).toEqual(["answer", "usage"]);
    expect(state.spentUsd).toBeCloseTo(usageCostUsd(grade.model, grade.usage), 8);
    expect(state.items[0]).toMatchObject({ correct: false, userAnswer: "I never was to Japan." });
  });

  it("accepts an answer the tutor graded right, with the item's explanation when it gave none", () => {
    const grading = apply(
      answering([typedItem(0), typedItem(1), typedItem(2), typedItem(3), typedItem(4)]),
      { type: "draft_changed", text: "I have never visited Japan." },
      { type: "check_started" },
    );
    const state = apply(grading, {
      type: "grade_received",
      grade: answerGradeWith({ correct: true, explanation: null }),
    });
    expect(state.feedback).toMatchObject({
      tone: "right",
      explanation: "Use the present perfect for an experience.",
    });
    expect(state.items[0]?.correct).toBe(true);
  });

  it("saves a flawed exercise as correct with the tutor's explanation", () => {
    const grading = apply(
      answering([typedItem(0), typedItem(1), typedItem(2), typedItem(3), typedItem(4)]),
      { type: "draft_changed", text: "I have never visited Japan." },
      { type: "check_started" },
    );
    const grade = answerGradeWith({
      correct: false,
      flawed: true,
      explanation: "Two answers fit this gap.",
    });
    const state = apply(grading, { type: "grade_received", grade });
    expect(state.items[0]?.correct).toBe(true);
    expect(state.writes[0]).toEqual({
      kind: "answer",
      itemId: "item-0",
      answer: { correct: true, userAnswer: "I have never visited Japan." },
    });
    expect(state.feedback).toMatchObject({
      tone: "right",
      title: "Nice one!",
      answer: null,
      explanation: "Two answers fit this gap.",
    });
    expect(state.writes.map((w) => w.kind)).toEqual(["answer", "usage"]);
    expect(state.spentUsd).toBeCloseTo(usageCostUsd(grade.model, grade.usage), 8);
  });

  it("shows the tutor's explanation when the tutor graded right", () => {
    const grading = apply(
      answering([typedItem(0), typedItem(1), typedItem(2), typedItem(3), typedItem(4)]),
      { type: "draft_changed", text: "I have never visited Japan." },
      { type: "check_started" },
    );
    const state = apply(grading, {
      type: "grade_received",
      grade: answerGradeWith({
        correct: true,
        flawed: false,
        explanation: "Visited also works here.",
      }),
    });
    expect(state.feedback).toMatchObject({
      tone: "right",
      explanation: "Visited also works here.",
    });
  });

  it("saves the grading cost even when its reply is unusable", () => {
    const grading = apply(
      answering([typedItem(0), typedItem(1), typedItem(2), typedItem(3), typedItem(4)]),
      { type: "draft_changed", text: "I have never visited Japan." },
      { type: "check_started" },
    );
    const usage = answerGradeWith().usage;
    const failed = apply(grading, {
      type: "grade_failed",
      failure: { source: "ai", failure: "bad_response" },
      usage,
    });
    expect(failed.writes.map((w) => w.kind)).toEqual(["usage"]);
    expect(failed.spentUsd).toBeGreaterThan(0);
  });

  it("keeps the draft after a failed grading and resends it on retry", () => {
    const grading = apply(
      answering([typedItem(0), typedItem(1), typedItem(2), typedItem(3), typedItem(4)]),
      { type: "draft_changed", text: "I have never visited Japan." },
      { type: "check_started" },
    );
    const failed = apply(grading, {
      type: "grade_failed",
      failure: { source: "ai", failure: "network" },
    });
    expect(failed.phase).toBe("answering");
    expect(failed.draft).toBe("I have never visited Japan.");
    expect(practiceStep(failed)).toEqual({ kind: "none" });
    expect(practiceRetryKind(failed)).toBe("resend");
    const retried = apply(failed, { type: "retry" });
    expect(retried.phase).toBe("grading");
    expect(practiceStep(retried).kind).toBe("grade");
  });

  it("goes back to answering after the usage of a failed grading is saved", () => {
    const grading = apply(
      answering([typedItem(0), typedItem(1), typedItem(2), typedItem(3), typedItem(4)]),
      { type: "draft_changed", text: "I have never visited Japan." },
      { type: "check_started" },
    );
    const failed = apply(
      grading,
      {
        type: "grade_failed",
        failure: { source: "ai", failure: "bad_response" },
        usage: answerGradeWith().usage,
      },
      { type: "write_done" },
    );
    expect(failed.phase).toBe("answering");
    expect(failed.draft).toBe("I have never visited Japan.");
  });
});

describe("the end of a round", () => {
  const lastOfFive = (miss: boolean) =>
    answering([0, 1, 2, 3].map((p) => item(p, true)).concat(item(4)));

  it("offers five more at the target with a miss", () => {
    const state = apply(
      lastOfFive(true),
      { type: "picked", option: "was" },
      { type: "write_done" },
      { type: "continue" },
    );
    expect(state.phase).toBe("result");
    expect(runOutcome(state)).toBe("offer");
    expect(practiceStep(state)).toEqual({ kind: "none" });
  });

  it("a flawed exercise leaves the missed rules and the escalation unchanged", () => {
    const start = answering([0, 1, 2, 3].map((p) => item(p, true)).concat(typedItem(4)));
    const grading = apply(
      start,
      { type: "draft_changed", text: "I have never visited Japan." },
      { type: "check_started" },
    );
    const state = apply(
      grading,
      {
        type: "grade_received",
        grade: answerGradeWith({ correct: false, flawed: true, explanation: "Flawed." }),
      },
      { type: "write_done" },
      { type: "write_done" },
      { type: "continue" },
    );
    expect(state.phase).toBe("finishing");
    expect(runOutcome(state)).toBe("finished");
    expect(missedRules(state.items)).toEqual([]);
    expect(practiceStep(state)).toEqual({ kind: "write", write: { kind: "finish" } });
  });

  it("finishes the run with no offer when nothing was missed", () => {
    const state = apply(
      lastOfFive(false),
      { type: "picked", option: "have been" },
      { type: "write_done" },
      { type: "continue" },
    );
    expect(state.phase).toBe("finishing");
    expect(practiceStep(state)).toEqual({ kind: "write", write: { kind: "finish" } });
  });

  it("has no offer at fifteen", () => {
    const items = Array.from({ length: 14 }, (_, p) => item(p, p === 12 ? false : true)).concat(
      item(14),
    );
    const state = apply(
      resumed(practiceTodayWith(items, { target: 15 })),
      { type: "picked", option: "was" },
      { type: "write_done" },
      { type: "continue" },
    );
    expect(state.phase).toBe("finishing");
    expect(runOutcome(state)).toBe("finished");
  });

  it("raises the target and asks again on keep going", () => {
    const offer = resumed(
      practiceTodayWith([0, 1, 2, 3].map((p) => item(p, true)).concat(item(4, false))),
    );
    const state = apply(offer, { type: "keep_going" });
    expect(state.run?.target).toBe(10);
    expect(state.phase).toBe("saving");
    expect(practiceStep(state)).toEqual({ kind: "write", write: { kind: "target", target: 10 } });
    const saved = apply(state, { type: "write_done", run: practiceRunWith({ target: 10 }) });
    expect(saved.phase).toBe("asking");
    expect(practiceStep(saved)).toEqual({
      kind: "round",
      request: roundRequest({ focus, count: 5, missedRules: ["Present perfect"], language: null }),
      count: 5,
    });
  });

  it("ignores keep going when there is no offer", () => {
    const start = answering();
    expect(apply(start, { type: "keep_going" })).toBe(start);
  });

  it("finishes the run when the learner finishes from the offer", () => {
    const offer = resumed(
      practiceTodayWith([0, 1, 2, 3].map((p) => item(p, true)).concat(item(4, false))),
    );
    const state = apply(offer, { type: "finish_requested" });
    expect(state.phase).toBe("finishing");
    expect(practiceStep(state)).toEqual({ kind: "write", write: { kind: "finish" } });
    const done = apply(state, {
      type: "write_done",
      run: practiceRunWith({ finishedAt: "2026-11-05T11:00:00Z" }),
    });
    expect(done.phase).toBe("result");
    expect(done.run?.finishedAt).not.toBeNull();
  });

  it("does not finish a run twice", () => {
    const finished = resumed(
      practiceTodayWith(
        [0, 1, 2, 3, 4].map((p) => item(p, true)),
        { finishedAt: "2026-11-05T11:00:00Z" },
      ),
    );
    expect(apply(finished, { type: "finish_requested" })).toBe(finished);
  });
});

describe("the spend", () => {
  it("does not ask while the spend is blocked", () => {
    const state = apply(fresh({ spentUsd: 10 }), { type: "write_done", run: practiceRunWith() });
    expect(sendState(state).locked).toBe(true);
    expect(practiceStep(state)).toEqual({ kind: "none" });
  });

  it("warns at 80% and keeps asking", () => {
    const state = apply(fresh({ spentUsd: 8 }), { type: "write_done", run: practiceRunWith() });
    expect(sendState(state)).toEqual({ locked: false, notice: "warning" });
    expect(practiceStep(state).kind).toBe("round");
  });

  it("locks answering when blocked", () => {
    const start = resumed(practiceTodayWith([0, 1, 2, 3, 4].map((p) => item(p))), 10);
    expect(apply(start, { type: "picked", option: "have been" })).toBe(start);
    expect(
      apply(start, { type: "draft_changed", text: "x" }, { type: "check_started" }).phase,
    ).toBe("answering");
  });

  it("still saves a write while blocked", () => {
    const state = apply(fresh({ spentUsd: 10 }));
    expect(practiceStep(state).kind).toBe("write");
  });

  it("locks the run for an OpenAI provider", () => {
    const state = startPractice({
      origin: { kind: "new", input: { focus: "mistakes", target: 5 } },
      opened: null,
      profile: { ...profile, provider: "openai" },
      spentUsd: 0,
      focus,
      language: null,
    });
    expect(sendState(state)).toEqual({ locked: true, notice: "unsupported" });
  });

  it("refreshes the context and clears a key failure", () => {
    const failed = apply(apply(fresh(), { type: "write_done", run: practiceRunWith() }), {
      type: "round_failed",
      failure: { source: "ai", failure: "invalid_key" },
    });
    const refreshed = apply(failed, {
      type: "context_refreshed",
      provider: "claude",
      limitUsd: 10,
      spentUsd: 1,
    });
    expect(refreshed.failure).toBeNull();
    expect(refreshed.spentUsd).toBe(1);
    expect(practiceStep(refreshed).kind).toBe("round");
  });
});

describe("segments, fillIndex and currentItem", () => {
  it("marks done, missed, current and pending", () => {
    const state = resumed(
      practiceTodayWith([item(0, true), item(1, false), item(2), item(3), item(4)]),
    );
    expect(segments(state)).toEqual(["done", "missed", "current", "pending", "pending"]);
  });

  it("draws one segment per exercise of the target", () => {
    const state = resumed(practiceTodayWith([item(0, true)], { target: 15 }));
    const list = segments(state);
    expect(list).toHaveLength(15);
    expect(list[0]).toBe("done");
    expect(list[1]).toBe("pending");
  });

  it("draws every segment pending before the first round", () => {
    expect(segments(fresh())).toEqual(["pending", "pending", "pending", "pending", "pending"]);
  });

  it("fills the segment of the item that was just answered", () => {
    const picked = apply(answering(), { type: "picked", option: "have been" });
    expect(fillIndex(picked)).toBe(0);
    expect(segments(picked)[0]).toBe("done");
    expect(fillIndex(answering())).toBeNull();
  });

  it("shows the answered item while the feedback is up", () => {
    const picked = apply(answering(), { type: "picked", option: "was" });
    expect(currentItem(picked)?.id).toBe("item-0");
  });

  it("has no current item once everything is answered", () => {
    const state = resumed(practiceTodayWith([0, 1, 2, 3, 4].map((p) => item(p, true))));
    expect(currentItem(state)).toBeNull();
  });
});

describe("exerciseView", () => {
  it("draws a choose item with its gap and no typed answer", () => {
    expect(exerciseView(item(0))).toEqual({
      kindLabel: "Choose the answer",
      rule: "Present perfect",
      prompt: "I ___ to Japan twice.",
      gap: { before: "I ", after: " to Japan twice." },
      card: null,
      typed: false,
    });
  });

  it("draws a gap item typed with its gap", () => {
    const view = exerciseView(
      item(0, null, { kind: "gap", options: null, prompt: "She ___ here.", accepted: ["lives"] }),
    );
    expect(view).toMatchObject({
      kindLabel: "Fill the gap",
      gap: { before: "She ", after: " here." },
      card: null,
      typed: true,
    });
  });

  it("draws a fix item as a card labeled From your chat when it has a source", () => {
    expect(exerciseView(typedItem(0))).toMatchObject({
      kindLabel: "Fix the sentence",
      gap: null,
      card: { label: "From your chat", text: "I never been to Japan." },
      typed: true,
    });
  });

  it("draws a fix item with no source as a card with no label", () => {
    const view = exerciseView(
      item(0, null, { kind: "fix", options: null, source: null, prompt: "He go." }),
    );
    expect(view.card).toEqual({ label: null, text: "He go." });
  });

  it("draws a translate item with its prompt and no card", () => {
    const view = exerciseView(
      item(0, null, {
        kind: "translate",
        options: null,
        prompt: "Nunca he estado.",
        accepted: ["I have never been."],
      }),
    );
    expect(view).toMatchObject({
      kindLabel: "Say it in English",
      prompt: "Nunca he estado.",
      gap: null,
      card: null,
      typed: true,
    });
  });
});

describe("gapFill", () => {
  it("fills the gap with the picked option", () => {
    expect(gapFill(apply(answering(), { type: "picked", option: "was" }))).toBe("was");
  });

  it("is null before an answer", () => {
    expect(gapFill(answering())).toBeNull();
  });

  it("fills a typed gap with the learner's text only when right", () => {
    const gapItems = [0, 1, 2, 3, 4].map((p) =>
      item(p, null, { kind: "gap", options: null, prompt: "She ___ here.", accepted: ["lives"] }),
    );
    const right = apply(
      answering(gapItems),
      { type: "draft_changed", text: "Lives" },
      { type: "check_started" },
    );
    expect(gapFill(right)).toBe("Lives");
  });

  it("fills the gap with the matched fill after a whole-sentence answer", () => {
    const gapItems = [0, 1, 2, 3, 4].map((p) =>
      item(p, null, {
        kind: "gap",
        options: null,
        prompt: "I ___ (not / can) remember who made the shot!",
        accepted: ["can't"],
      }),
    );
    const right = apply(
      answering(gapItems),
      { type: "draft_changed", text: "I can't remember who made the shot." },
      { type: "check_started" },
    );
    expect(gapFill(right)).toBe("can't");
  });
});

describe("runBody", () => {
  it("draws the exercise while answering, grading, in feedback and saving", () => {
    const state = answering();
    expect(runBody(state)).toBe("exercise");
    expect(runBody({ ...state, phase: "grading" })).toBe("exercise");
    expect(runBody({ ...state, phase: "saving" })).toBe("exercise");
    expect(runBody(apply(state, { type: "picked", option: "was" }))).toBe("exercise");
  });

  it("draws the generating state while a round is asked or the run is created", () => {
    expect(runBody(fresh())).toBe("generating");
    const asking = resumed(practiceTodayWith([], { target: 5 }));
    expect(asking.phase).toBe("asking");
    expect(runBody(asking)).toBe("generating");
  });

  it("draws the generating state when no item is on screen, even answering", () => {
    expect(runBody({ ...answering([]), phase: "answering" })).toBe("generating");
  });

  it("draws the result in the result and finishing phases", () => {
    const state = answering();
    expect(runBody({ ...state, phase: "result" })).toBe("result");
    expect(runBody({ ...state, phase: "finishing" })).toBe("result");
  });
});

describe("progressPosition", () => {
  it("is the position of the item on screen, one based", () => {
    expect(progressPosition(answering())).toBe(1);
    const third = answering([0, 1, 2, 3, 4].map((p) => item(p, p < 2 ? true : null)));
    expect(progressPosition(third)).toBe(3);
  });

  it("is 1 before the first round", () => {
    expect(progressPosition(fresh())).toBe(1);
  });

  it("counts the answered item while its feedback is up", () => {
    expect(progressPosition(apply(answering(), { type: "picked", option: "was" }))).toBe(1);
  });

  it("is the next exercise while a round is asked after the 5th answer of a 10 run", () => {
    const asked = resumed(
      practiceTodayWith(
        [0, 1, 2, 3, 4].map((p) => item(p, true)),
        { target: 10 },
      ),
    );
    expect(asked.phase).toBe("asking");
    expect(progressPosition(asked)).toBe(6);
  });

  it("stops at the target", () => {
    const done = resumed(
      practiceTodayWith(
        [0, 1, 2, 3, 4].map((p) => item(p, true)),
        { target: 5 },
      ),
    );
    expect(progressPosition(done)).toBe(5);
  });
});

describe("optionState", () => {
  it("is idle for every option before an answer", () => {
    expect(optionState(answering(), "was")).toBe("idle");
  });

  it("is right for the picked option when it was right", () => {
    const picked = apply(answering(), { type: "picked", option: "have been" });
    expect(optionState(picked, "have been")).toBe("right");
  });

  it("is wrong for the picked option when it was wrong", () => {
    const picked = apply(answering(), { type: "picked", option: "was" });
    expect(optionState(picked, "was")).toBe("wrong");
  });

  it("is idle for an option that was not picked", () => {
    const picked = apply(answering(), { type: "picked", option: "was" });
    expect(optionState(picked, "have been")).toBe("idle");
  });

  it("is idle when no item is on screen", () => {
    const picked = apply(answering(), { type: "picked", option: "was" });
    expect(optionState({ ...picked, items: [] }, "was")).toBe("idle");
  });
});

describe("the study note of a missed exercise", () => {
  const failure = { source: "ai", failure: "rate_limited" } as const;
  const missSheet = (start: PracticeRunState = answering()) =>
    apply(start, { type: "picked", option: "was" }, { type: "write_done" });
  const rightSheet = () =>
    apply(answering(), { type: "picked", option: "have been" }, { type: "write_done" });
  const asking = () => apply(missSheet(), { type: "note_requested" });

  it("asks for a study note on the missed item", () => {
    const state = asking();
    expect(state.noteRequest).toEqual({ itemId: "item-0", status: "asking" });
    expect(state.phase).toBe("feedback");
    expect(practiceStep(state)).toEqual({
      kind: "note",
      request: studyNoteRequest(state.items[0] ?? item(0)),
    });
  });

  it("ignores a study note request on a right answer, a words run or a locked run", () => {
    expect(apply(rightSheet(), { type: "note_requested" }).noteRequest).toBeNull();
    const words = resumed(
      practiceTodayWith(
        [0, 1, 2, 3, 4].map((p) => item(p)),
        { focus: "words" },
      ),
    );
    const wordsState = { ...words, focus: { kind: "words" as const, words: ["catchy"] } };
    expect(apply(missSheet(wordsState), { type: "note_requested" }).noteRequest).toBeNull();
    const locked = apply(missSheet(), {
      type: "context_refreshed",
      provider: "claude",
      limitUsd: 1,
      spentUsd: 1,
    });
    expect(apply(locked, { type: "note_requested" }).noteRequest).toBeNull();
    expect(apply(answering(), { type: "note_requested" }).noteRequest).toBeNull();
  });

  it("queues the note with no session and its usage on the run", () => {
    const reply = studyNoteReplyWith();
    const before = missSheet();
    const state = apply(asking(), { type: "note_received", note: reply });
    expect(state.writes).toEqual([
      { kind: "note", input: { ...reply.note, sessionId: null } },
      {
        kind: "usage",
        usage: {
          model: reply.model,
          inputTokens: reply.usage.inputTokens,
          outputTokens: reply.usage.outputTokens,
          cacheCreationInputTokens: reply.usage.cacheCreationInputTokens,
          cacheReadInputTokens: reply.usage.cacheReadInputTokens,
        },
      },
    ]);
    expect(state.spentUsd).toBe(
      Math.round((before.spentUsd + usageCostUsd(reply.model, reply.usage)) * 1e8) / 1e8,
    );
    expect(state.noteRequest).toEqual({ itemId: "item-0", status: "saving" });
  });

  it("keeps the miss sheet while the note saves", () => {
    const saving = apply(asking(), { type: "note_received", note: studyNoteReplyWith() });
    expect(saving.feedback?.tone).toBe("miss");
    const noteSaved = apply(saving, { type: "write_done", noteId: "note-9" });
    expect(noteSaved.phase).toBe("saving");
    const done = apply(noteSaved, { type: "write_done" });
    expect(done.phase).toBe("feedback");
    expect(done.feedback?.tone).toBe("miss");
  });

  it("sets the note to open when its write returns", () => {
    const saving = apply(asking(), { type: "note_received", note: studyNoteReplyWith() });
    const saved = apply(saving, { type: "write_done", noteId: "note-9" });
    expect(saved.openNote).toBe("note-9");
    expect(saved.noteRequest).toBeNull();
  });

  it("clears the note to open once opened", () => {
    const saved = apply(
      asking(),
      { type: "note_received", note: studyNoteReplyWith() },
      { type: "write_done", noteId: "note-9" },
      { type: "note_opened" },
    );
    expect(saved.openNote).toBeNull();
  });

  it("saves the usage of a billed note failure", () => {
    const usage = studyNoteReplyWith().usage;
    const state = apply(asking(), { type: "note_failed", failure, usage });
    expect(state.noteRequest).toEqual({ itemId: "item-0", status: "failed" });
    expect(state.failure).toEqual(failure);
    expect(state.writes).toEqual([
      { kind: "usage", usage: expect.objectContaining({ inputTokens: usage.inputTokens }) },
    ]);
    expect(state.spentUsd).toBeGreaterThan(missSheet().spentUsd);
  });

  it("asks again on retry after a note failure", () => {
    const failed = apply(asking(), { type: "note_failed", failure });
    expect(failed.writes).toEqual([]);
    expect(practiceStep(failed)).toEqual({ kind: "none" });
    const retried = apply(failed, { type: "retry" });
    expect(retried.failure).toBeNull();
    expect(retried.noteRequest?.status).toBe("asking");
    expect(practiceStep(retried).kind).toBe("note");
    expect(practiceRetryKind(failed)).toBe("resend");
  });

  it("keeps Continue busy while a note is in flight", () => {
    const state = asking();
    expect(apply(state, { type: "continue" })).toBe(state);
    const saving = apply(state, { type: "note_received", note: studyNoteReplyWith() });
    expect(apply(saving, { type: "continue" }).feedback).not.toBeNull();
  });

  it("drops a failed note request on Continue", () => {
    const failed = apply(asking(), { type: "note_failed", failure });
    const next = apply(failed, { type: "continue" });
    expect(next.noteRequest).toBeNull();
    expect(next.failure).toBeNull();
    expect(next.feedback).toBeNull();
    expect(currentItem(next)?.id).toBe("item-1");
  });

  it("allows asking again after a failure", () => {
    const failed = apply(asking(), { type: "note_failed", failure }, { type: "retry" });
    expect(failed.noteRequest?.status).toBe("asking");
    const failedAgain = apply(failed, { type: "note_failed", failure });
    expect(apply(failedAgain, { type: "note_requested" }).noteRequest?.status).toBe("asking");
  });

  it("starts a run with no note in flight", () => {
    expect(answering().noteRequest).toBeNull();
    expect(answering().openNote).toBeNull();
  });

  describe("noteAction", () => {
    it("is null on a right sheet, with no sheet and on a words run", () => {
      expect(noteAction(rightSheet())).toBeNull();
      expect(noteAction(answering())).toBeNull();
      const words = { ...missSheet(), focus: { kind: "words" as const, words: ["catchy"] } };
      expect(noteAction(words)).toBeNull();
    });

    it("is idle on a miss sheet", () => {
      expect(noteAction(missSheet())).toEqual({ busy: false, disabled: false });
    });

    it("is busy while asking and saving", () => {
      expect(noteAction(asking())).toEqual({ busy: true, disabled: false });
      const saving = apply(asking(), { type: "note_received", note: studyNoteReplyWith() });
      expect(noteAction(saving)?.busy).toBe(true);
    });

    it("is not busy after a failure", () => {
      const failed = apply(asking(), { type: "note_failed", failure });
      expect(noteAction(failed)?.busy).toBe(false);
    });

    it("is disabled when the spend limit locks the run", () => {
      const locked = apply(missSheet(), {
        type: "context_refreshed",
        provider: "claude",
        limitUsd: 1,
        spentUsd: 1,
      });
      expect(noteAction(locked)).toEqual({ busy: false, disabled: true });
    });
  });

  describe("continueBusy", () => {
    it("is false on a sheet with nothing in flight", () => {
      expect(continueBusy(missSheet())).toBe(false);
      expect(continueBusy(rightSheet())).toBe(false);
    });

    it("is true while the run is saving, with or without a note action", () => {
      expect(continueBusy({ ...rightSheet(), phase: "saving" })).toBe(true);
      expect(continueBusy({ ...missSheet(), phase: "saving" })).toBe(true);
    });

    it("is true while a note is being asked for and false after it failed", () => {
      expect(continueBusy(asking())).toBe(true);
      expect(continueBusy(apply(asking(), { type: "note_failed", failure }))).toBe(false);
    });
  });
});
