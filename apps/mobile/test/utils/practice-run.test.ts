// apps/mobile/test/utils/practice-run.test.ts
//
// Tests for the state machine of a practice run.
//
// Tested:
// - The code check uses this run's prompts, the rejected ones and the recent ones as avoid; the writer gets no avoid list
// - Every write attempt of a run is counted and gets the scenario of its count, so no scenario comes back within 24 writes, Try again included; no seed for a fix on a learner's own correction
// - startPractice: a new run starts by creating the run; a resumed run settles on its items and plans only its missing positions
// - practiceReducer and practiceStep: the order of the outside calls of a slot (write, code check, solver, reviewer for every kind), of an answer and of the grader
// - A topic slot keeps its point on a rewrite and takes the next one after a full round fails; the rule label and the source are set by code, not by the writer
// - Only choose is held to a single answer: a typed kind goes to review whatever the solver says, the solver's answer joins accepted when the reviewer accepts it; the failure shows after two full rounds
// - Kinds that fit the point: a contrast topic falls back on choose and fix only; a kind that uses up its attempts is dead and later slots start past it; Try again clears the dead kinds
// - A slot is written again after a failed check, up to three attempts per kind, then switches kind (choose, gap, fix, never translate); the AI failure with Try again only when every kind is exhausted, and Try again restarts from the planned kind
// - One exercise ahead: a passed exercise is saved at its position, the next slot is written while the learner answers, and generating shows only when the next one is not ready
// - A background write never takes a write the screen waits on, and a background AI failure waits until the learner is waiting
// - The checks save: sent with the item's save or after a rejection, kept when it fails, twenty at a time
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
import {
  PRACTICE_REVIEW_MODEL,
  PRACTICE_SOLVER_MODEL,
  PRACTICE_WRITER_MODEL,
  TUTOR_MODEL,
  usageCostUsd,
  type PracticeRunWithItems,
  TOPIC_POINTS,
} from "@fluency-lab/shared";

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
  exerciseRequest,
  gradeRequest,
  reviewRequest,
  solveRequest,
  studyNoteRequest,
  type FocusData,
} from "@/utils/practice-prompt";
import { codeRow } from "@/utils/practice-check";
import { seedFor } from "@/utils/practice-seeds";
import { planSlots } from "@/utils/practice-slots";
import {
  completedProfile,
  practiceItemWith,
  practiceRunWith,
  practiceTodayWith,
} from "../helpers/fake-data";
import {
  answerGradeWith,
  exerciseDraftWith,
  exerciseFor,
  reviewWith,
  solutionWith,
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
    recent: [],
  });
}

function resumed(opened: PracticeRunWithItems, spentUsd = 0, language: string | null = null) {
  return startPractice({
    origin: { kind: "resume", runId: opened.run.id },
    opened,
    profile,
    spentUsd,
    focus,
    language,
    recent: [],
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

// INFO: what the hook does: runs every write and checks save the reducer asks for, until the
// next step is an AI call or nothing. A save of an item answers every item of the run.
function drain(state: PracticeRunState): PracticeRunState {
  let current = state;
  for (let guard = 0; guard < 50; guard += 1) {
    const step = practiceStep(current);
    if (step.kind === "checks") {
      current = apply(current, { type: "checks_saved", count: step.checks.length });
    } else if (step.kind === "write") {
      const { write, lane } = step;
      const items =
        write.kind === "items"
          ? [
              ...current.items,
              ...write.items.map((created) => item(created.position, null, created)),
            ]
          : undefined;
      const finishedAt = write.kind === "finish" ? "2026-11-05T11:00:00Z" : null;
      current = apply(current, {
        type: "write_done",
        lane,
        items,
        run:
          write.kind === "create"
            ? practiceRunWith()
            : write.kind === "finish" && current.run !== null
              ? { ...current.run, finishedAt }
              : undefined,
      });
    } else {
      return current;
    }
  }
  throw new Error("drain did not stop");
}

// INFO: one slot written, solved and reviewed, all passing.
function passSlot(state: PracticeRunState, n: number): PracticeRunState {
  const kind = state.work?.slot.kind ?? "choose";
  const exercise = exerciseFor(kind, n);
  const written = apply(state, {
    type: "exercise_written",
    draft: exerciseDraftWith({ exercise }),
  });
  const solved = apply(written, {
    type: "exercise_solved",
    solution: solutionWith({ answer: exercise.accepted[0] ?? "" }),
  });
  return solved.work?.stage === "review"
    ? apply(solved, { type: "exercise_reviewed", review: reviewWith() })
    : solved;
}

function workOf(state: PracticeRunState) {
  if (state.work === null) throw new Error("no slot is being worked");
  return state;
}

const created = apply(fresh(), { type: "write_done", run: practiceRunWith() });
const aiFailure = (failure: "bad_response" | "refused" | "network" | "invalid_key") =>
  ({ source: "ai", failure }) as const;

// INFO: n writer failures that each use up an attempt of the slot being written.
const failTimes = (state: PracticeRunState, n: number) =>
  Array.from({ length: n }).reduce<PracticeRunState>(
    (current) => apply(current, { type: "exercise_failed", failure: aiFailure("bad_response") }),
    state,
  );
// INFO: a run with positions 0 and 1 answered, so the slot being worked is the fix at position 2.
const fixSlot = () => resumed(practiceTodayWith([item(0, true), item(1, true)], { target: 5 }));

describe("startPractice", () => {
  it("starts by creating the run", () => {
    const state = fresh();
    expect(state.phase).toBe("creating");
    expect(state.work).toBeNull();
    expect(practiceStep(state)).toEqual({
      kind: "write",
      lane: "screen",
      write: { kind: "create", input: { focus: "mistakes", target: 5 } },
    });
  });

  it("writes the first slot after the run is created", () => {
    expect(created.phase).toBe("asking");
    expect(created.run?.id).toBe("run-1");
    expect(practiceStep(created)).toEqual({
      kind: "exercise",
      request: exerciseRequest({
        slot: created.slots[0]!,
        missedRules: [],
        language: null,
        seed: created.work?.seed ?? null,
      }),
    });
  });

  it("checks a written prompt against this run's earlier prompts and the recent ones of other runs", () => {
    const own = exerciseFor("fix", 5);
    const old = exerciseFor("fix", 4);
    const recent = [{ runId: "old-run", prompt: old.prompt, rule: "Verbs" }];
    const state = startPractice({
      origin: { kind: "resume", runId: "run-1" },
      opened: practiceTodayWith(
        [item(0, true, { prompt: "First ___." }), item(1, true, { prompt: own.prompt })],
        { target: 5 },
      ),
      profile,
      spentUsd: 0,
      focus,
      language: null,
      recent,
    });
    for (const exercise of [own, old]) {
      const written = apply(state, {
        type: "exercise_written",
        draft: exerciseDraftWith({ exercise }),
      });
      expect(written.checks[0]).toMatchObject({ stage: "code", passed: false, reason: "repeat" });
    }
  });

  it("checks a written prompt against the slot's rejected prompts", () => {
    const exercise = exerciseFor("choose", 1);
    const mismatch = apply(
      created,
      { type: "exercise_written", draft: exerciseDraftWith({ exercise }) },
      { type: "exercise_solved", solution: solutionWith({ answer: "was" }) },
    );
    const again = apply(mismatch, {
      type: "exercise_written",
      draft: exerciseDraftWith({ exercise }),
    });
    expect(again.checks[2]).toMatchObject({ stage: "code", passed: false, reason: "repeat" });
  });

  it("lets a rewrite look like a rejected prompt the learner never saw", () => {
    const first = { ...exerciseFor("choose", 1), prompt: "Anna ___ to Japan with her parents." };
    const second = {
      ...exerciseFor("choose", 1),
      prompt: "Anna ___ to Japan with her parents last summer.",
    };
    const mismatch = apply(
      created,
      { type: "exercise_written", draft: exerciseDraftWith({ exercise: first }) },
      { type: "exercise_solved", solution: solutionWith({ answer: "was" }) },
    );
    const again = apply(mismatch, {
      type: "exercise_written",
      draft: exerciseDraftWith({ exercise: second }),
    });
    expect(again.checks[2]).toMatchObject({ stage: "code", passed: true });
  });

  it("sends no avoid list to the writer", () => {
    const step = practiceStep(created);
    const turn = step.kind === "exercise" ? JSON.parse(step.request.turns[0]?.text ?? "{}") : {};
    expect(turn).not.toHaveProperty("avoid");
  });

  it("settles a resumed run on its first unanswered item", () => {
    const state = answering();
    expect(state.phase).toBe("answering");
    expect(currentItem(state)?.id).toBe("item-0");
  });

  it("settles a resumed run with no items on asking", () => {
    const state = resumed(practiceTodayWith([]));
    expect(state.phase).toBe("asking");
    expect(practiceStep(state).kind).toBe("exercise");
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
    expect(practiceStep(state)).toEqual({
      kind: "write",
      lane: "screen",
      write: { kind: "finish" },
    });
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
        { finishedAt: "2026-11-05T11:00:00Z" },
      ),
    );
    expect(state.phase).toBe("result");
    expect(practiceStep(state)).toEqual({ kind: "none" });
  });
});

describe("planning", () => {
  it("plans every position of a new run after it is created", () => {
    expect(created.slots.map((slot) => slot.position)).toEqual([0, 1, 2, 3, 4]);
    expect(created.slots.map((slot) => slot.kind)).toEqual([
      "choose",
      "gap",
      "fix",
      "choose",
      "gap",
    ]);
    expect(created.work?.slot).toEqual(created.slots[0]);
  });

  it("plans only the missing positions of a resumed run", () => {
    const state = resumed(
      practiceTodayWith([item(0, true), item(1, true), item(3, true)], { target: 5 }),
    );
    expect(state.slots.map((slot) => slot.position)).toEqual([2, 4]);
    expect(state.work?.slot.position).toBe(2);
  });

  it("plans the device language's translate", () => {
    const state = resumed(practiceTodayWith([item(0, true), item(1, true)]), 0, "es-AR");
    expect(state.slots[0]?.kind).toBe("translate");
    const step = practiceStep(state);
    expect(step.kind === "exercise" && step.request.system).toContain("es-AR");
  });

  it("plans the next five on keep going", () => {
    const offer = resumed(
      practiceTodayWith([0, 1, 2, 3].map((p) => item(p, true)).concat(item(4, false))),
    );
    expect(offer.slots).toEqual([]);
    const state = apply(offer, { type: "keep_going" });
    expect(state.slots).toEqual(
      planSlots({
        runId: "run-1",
        positions: [5, 6, 7, 8, 9],
        focus,
        language: null,
        usedRules: [
          "Present perfect",
          "Present perfect",
          "Present perfect",
          "Present perfect",
          "Present perfect",
        ],
      }),
    );
  });
});

describe("the seed of a write attempt", () => {
  const scenarioOf = (state: PracticeRunState) => state.work?.seed?.scenario;
  // INFO: the scenarios of every write of a run, in order, as the state saw them.
  const scenariosOver = (state: PracticeRunState, failures: number) => {
    const seen: (string | undefined)[] = [scenarioOf(state)];
    let current = state;
    for (let i = 0; i < failures; i += 1) {
      current = failTimes(current, 1);
      seen.push(scenarioOf(current));
    }
    return { seen, current };
  };

  it("gives a slot the seed of the run's first write when it starts", () => {
    expect(created.work?.seed).toEqual(seedFor({ runId: "run-1", writeCount: 0 }));
    expect(created.writeCount).toBe(1);
  });

  it("counts every write attempt: a failed attempt and a kind switch", () => {
    expect(failTimes(created, 1).writeCount).toBe(2);
    const switched = failTimes(created, 3);
    expect(switched.work).toMatchObject({ attempt: 1, slot: { kind: "gap" } });
    expect(switched.writeCount).toBe(4);
    expect(switched.work?.seed).toEqual(seedFor({ runId: "run-1", writeCount: 3 }));
  });

  it("gives a new scenario to each write while the slot keeps failing", () => {
    const { seen } = scenariosOver(created, 5);
    expect(new Set(seen).size).toBe(seen.length);
  });

  it("brings a scenario not used before in the run on Try again after every kind is used up", () => {
    const exhausted = failTimes(created, 18);
    const earlier = scenariosOver(created, 17).seen;
    const retried = apply(exhausted, { type: "retry" });
    expect(retried.failure).toBeNull();
    expect(earlier.filter((scenario) => scenario !== undefined)).not.toContain(scenarioOf(retried));
    expect(retried.writeCount).toBeGreaterThan(exhausted.writeCount - 1);
  });

  it("never resets the write count on Try again", () => {
    const exhausted = failTimes(created, 18);
    const retried = apply(exhausted, { type: "retry" });
    expect(failTimes(retried, 1).writeCount).toBe(retried.writeCount + 1);
    expect(retried.writeCount).toBeGreaterThanOrEqual(10);
  });

  it("starts a resumed run's write count at its saved items", () => {
    const state = resumed(practiceTodayWith([item(0, true), item(1, true)], { target: 5 }));
    expect(state.writeCount).toBe(3);
  });

  it("does not change the seed on a network failure", () => {
    const failed = apply(created, { type: "exercise_failed", failure: aiFailure("network") });
    expect(failed.work?.seed).toEqual(created.work?.seed);
    expect(failed.writeCount).toBe(created.writeCount);
  });

  it("gives no seed to a fix on a learner's own correction", () => {
    const corrections: FocusData = {
      kind: "mistakes",
      corrections: [
        { original: "I has", corrected: "I have", rule: "Verbs" },
        { original: "a apple", corrected: "an apple", rule: "Articles" },
      ],
    };
    const state = startPractice({
      origin: { kind: "resume", runId: "run-1" },
      opened: practiceTodayWith([item(0, true), item(1, true)], { target: 5 }),
      profile,
      spentUsd: 0,
      focus: corrections,
      language: null,
      recent: [],
    });
    expect(state.work?.slot.kind).toBe("fix");
    expect(state.work?.slot.target).toMatchObject({
      focus: "mistakes",
      correction: { original: expect.any(String) },
    });
    expect(state.work?.seed).toBeNull();
    const step = practiceStep(state);
    const turn = step.kind === "exercise" ? JSON.parse(step.request.turns[0]?.text ?? "{}") : {};
    expect(turn).not.toHaveProperty("scenario");
  });
});

describe("the points of a topic and the fields set by code", () => {
  const topicRun = () =>
    startPractice({
      origin: { kind: "resume", runId: "run-1" },
      opened: practiceTodayWith([], { target: 5 }),
      profile,
      spentUsd: 0,
      focus: {
        kind: "topic",
        topic: "Going to vs will",
        level: null,
        contrast: true,
        points: TOPIC_POINTS.going_to_vs_will,
      },
      language: null,
      recent: [],
    });
  const pointOf = (state: PracticeRunState) =>
    state.work?.slot.target.focus === "topic" ? state.work.slot.target.point : undefined;
  const savedItem = (state: PracticeRunState) => {
    const write = state.background.find((entry) => entry.kind === "items");
    return write?.kind === "items" ? write.items[0] : undefined;
  };

  it("keeps the slot's point on a rewrite", () => {
    const state = topicRun();
    expect(pointOf(state)).not.toBeNull();
    expect(pointOf(failTimes(state, 1))).toEqual(pointOf(state));
    expect(pointOf(failTimes(state, 3))).toEqual(pointOf(state));
  });

  it("moves the slot to the topic's next point after a full round over every kind fails", () => {
    const state = topicRun();
    const labels = TOPIC_POINTS.going_to_vs_will.map((point) => point.label);
    const before = labels.indexOf(pointOf(state)?.label ?? "");
    const after = labels.indexOf(pointOf(failTimes(state, 6))?.label ?? "");
    expect(after).toBe((before + 1) % labels.length);
  });

  it("saves the point's label as the rule of a topic exercise, whatever the writer wrote", () => {
    const state = topicRun();
    const exercise = { ...exerciseFor("choose", 1), rule: "Present simple for timetabled events" };
    const passed = passSlot({ ...state }, 1);
    const written = apply(state, {
      type: "exercise_written",
      draft: exerciseDraftWith({ exercise }),
    });
    expect(written.work?.exercise?.rule).toBe(pointOf(state)?.label);
    expect(written.checks[0]?.exercise).toMatchObject({ rule: pointOf(state)?.label });
    expect(savedItem(passed)?.rule).toBe(pointOf(state)?.label);
  });

  it("saves a learner's correction rule as the rule of its exercise", () => {
    const exercise = { ...exerciseFor("choose", 1), rule: "Writer's own label" };
    const written = apply(created, {
      type: "exercise_written",
      draft: exerciseDraftWith({ exercise }),
    });
    expect(written.work?.exercise?.rule).toBe("Verbs");
  });

  it("keeps the writer's rule for an open target", () => {
    const open: PracticeRunState = {
      ...created,
      work:
        created.work === null
          ? null
          : {
              ...created.work,
              slot: { ...created.work.slot, target: { focus: "mistakes", correction: null } },
            },
    };
    const written = apply(open, {
      type: "exercise_written",
      draft: exerciseDraftWith({ exercise: { ...exerciseFor("choose", 1), rule: "Articles" } }),
    });
    expect(written.work?.exercise?.rule).toBe("Articles");
  });

  it("saves no source on an exercise that is not a fix on a learner's correction", () => {
    const state = topicRun();
    const exercise = { ...exerciseFor("choose", 1), source: "Some sentence from nowhere." };
    const written = apply(state, {
      type: "exercise_written",
      draft: exerciseDraftWith({ exercise }),
    });
    expect(written.work?.exercise?.source).toBeNull();
  });

  it("keeps the source of a fix on a learner's correction", () => {
    const corrections: FocusData = {
      kind: "mistakes",
      corrections: [
        { original: "I has", corrected: "I have", rule: "Verbs" },
        { original: "a apple", corrected: "an apple", rule: "Articles" },
      ],
    };
    const state = startPractice({
      origin: { kind: "resume", runId: "run-1" },
      opened: practiceTodayWith([item(0, true), item(1, true)], { target: 5 }),
      profile,
      spentUsd: 0,
      focus: corrections,
      language: null,
      recent: [],
    });
    const written = apply(state, {
      type: "exercise_written",
      draft: exerciseDraftWith({ exercise: exerciseFor("fix", 9) }),
    });
    expect(written.work?.exercise?.source).toBe("She go to work 9 days a week.");
  });
});

describe("kinds that fit the point", () => {
  const contrastRun = () =>
    startPractice({
      origin: { kind: "resume", runId: "run-1" },
      opened: practiceTodayWith([], { target: 5 }),
      profile,
      spentUsd: 0,
      focus: {
        kind: "topic",
        topic: "Going to vs will",
        level: null,
        contrast: true,
        points: TOPIC_POINTS.going_to_vs_will,
      },
      language: null,
      recent: [],
    });
  // INFO: the run's next slot, planned with the given kind, scheduled over the given dead kinds.
  const nextSlot = (kind: "choose" | "gap" | "fix", deadKinds: ("choose" | "gap" | "fix")[]) => {
    const target = { focus: "mistakes" as const, correction: null };
    const idle: PracticeRunState = {
      ...created,
      work: null,
      slots: [{ position: 3, kind, target }],
      deadKinds,
    };
    return practiceReducer(idle, { type: "draft_changed", text: "" });
  };

  it("falls back from choose to fix, never to gap, on a contrast topic", () => {
    const state = contrastRun();
    expect(state.work?.slot.kind).toBe("choose");
    expect(failTimes(state, 3).work).toMatchObject({ attempt: 1, slot: { kind: "fix" } });
  });

  it("shows the AI failure once choose and fix are used up on a contrast topic", () => {
    expect(failTimes(contrastRun(), 11).failure).toBeNull();
    expect(failTimes(contrastRun(), 12).failure).toMatchObject({
      source: "ai",
      cause: { name: "PracticeChecks" },
    });
  });

  it("marks a kind dead once it uses up its attempts on a slot", () => {
    expect(failTimes(fixSlot(), 2).deadKinds).toEqual([]);
    expect(failTimes(fixSlot(), 3).deadKinds).toEqual(["fix"]);
    expect(failTimes(fixSlot(), 6).deadKinds).toEqual(["fix", "choose"]);
  });

  it("starts a later slot planned as fix on choose once fix is dead", () => {
    expect(nextSlot("fix", ["fix"]).work).toMatchObject({ attempt: 1, slot: { kind: "choose" } });
    expect(nextSlot("fix", []).work).toMatchObject({ slot: { kind: "fix" } });
  });

  it("starts a later slot on its planned kind when every kind is dead", () => {
    expect(nextSlot("fix", ["choose", "gap", "fix"]).work).toMatchObject({ slot: { kind: "fix" } });
  });

  it("clears the dead kinds on Try again after every kind is used up", () => {
    const exhausted = failTimes(created, 18);
    const retried = apply(exhausted, { type: "retry" });
    expect(retried.deadKinds).toEqual([]);
    expect(retried.work).toMatchObject({ attempt: 1, slot: { kind: "choose" } });
  });

  it("restarts from the planned kind even when the slot started on a fallback", () => {
    const started = nextSlot("fix", ["fix"]);
    expect(failTimes(started, 17).failure).toBeNull();
    const exhausted = failTimes(started, 18);
    expect(exhausted.failure).toMatchObject({ cause: { name: "PracticeChecks" } });
    const retried = apply(exhausted, { type: "retry" });
    expect(retried.work).toMatchObject({ attempt: 1, slot: { kind: "fix" } });
  });
});

describe("only choose is held to a single answer", () => {
  const gapSlot = () => drain(passSlot(created, 1));
  const savedItem = (state: PracticeRunState) => {
    const write = state.background.find((entry) => entry.kind === "items");
    return write?.kind === "items" ? write.items[0] : undefined;
  };

  it("sends a gap whose solver answer differs to review and saves it when the review passes", () => {
    const state = gapSlot();
    expect(state.work?.slot.kind).toBe("gap");
    const solved = apply(
      state,
      { type: "exercise_written", draft: exerciseDraftWith({ exercise: exerciseFor("gap", 2) }) },
      { type: "exercise_solved", solution: solutionWith({ answer: "have gone" }) },
    );
    expect(solved.work).toMatchObject({ stage: "review", solverAnswer: "have gone" });
    const reviewed = apply(solved, {
      type: "exercise_reviewed",
      review: reviewWith({ singleAnswer: false, solverAnswerAccepted: false, passed: false }),
    });
    expect(savedItem(reviewed)).toMatchObject({ position: 1, kind: "gap", accepted: ["went"] });
  });

  it("adds the solver's answer to accepted when the reviewer accepts it", () => {
    const reviewed = apply(
      gapSlot(),
      { type: "exercise_written", draft: exerciseDraftWith({ exercise: exerciseFor("gap", 2) }) },
      { type: "exercise_solved", solution: solutionWith({ answer: "travelled" }) },
      { type: "exercise_reviewed", review: reviewWith({ solverAnswerAccepted: true }) },
    );
    expect(savedItem(reviewed)?.accepted).toEqual(["went", "travelled"]);
  });

  it("shows no failure after one full round and shows it after two", () => {
    const oneRound = failTimes(created, 9);
    expect(oneRound.failure).toBeNull();
    expect(oneRound.work).toMatchObject({ attempt: 1, round: 2, slot: { kind: "choose" } });
    expect(failTimes(created, 17).failure).toBeNull();
    expect(failTimes(created, 18).failure).toMatchObject({ cause: { name: "PracticeChecks" } });
  });

  it("starts two more rounds on Try again", () => {
    const retried = apply(failTimes(created, 18), { type: "retry" });
    expect(retried.work).toMatchObject({ attempt: 1, round: 1 });
    expect(failTimes(retried, 17).failure).toBeNull();
    expect(failTimes(retried, 18).failure).toMatchObject({ cause: { name: "PracticeChecks" } });
  });
});

describe("a slot", () => {
  it("writes the first slot, then checks it with the code check", () => {
    const written = apply(created, {
      type: "exercise_written",
      draft: exerciseDraftWith({ exercise: exerciseFor("choose", 1) }),
    });
    expect(workOf(written).work).toMatchObject({ stage: "solve", attempt: 1 });
    expect(written.checks).toHaveLength(1);
    expect(written.checks[0]).toMatchObject({ stage: "code", passed: true, reason: null });
    expect(written.checksDue).toBe(false);
    const exercise = written.work?.exercise;
    expect(exercise).toMatchObject({ kind: "choose" });
    expect(practiceStep(drain(written))).toEqual({
      kind: "solve",
      request: solveRequest(exercise!),
    });
  });

  it("saves the writer's usage with the model that ran it and adds its cost", () => {
    const draft = exerciseDraftWith({ exercise: exerciseFor("choose", 1) });
    const written = apply(created, { type: "exercise_written", draft });
    expect(written.background[0]).toEqual({
      kind: "usage",
      usage: { model: PRACTICE_WRITER_MODEL, ...draft.usage },
    });
    expect(written.spentUsd).toBeCloseTo(usageCostUsd(draft.model, draft.usage), 8);
  });

  it("sends a choose the solver matches to the reviewer, not straight to the save", () => {
    const exercise = exerciseFor("choose", 1);
    const solved = apply(
      created,
      { type: "exercise_written", draft: exerciseDraftWith({ exercise }) },
      { type: "exercise_solved", solution: solutionWith({ answer: "have been" }) },
    );
    expect(workOf(solved).work).toMatchObject({ stage: "review", solverAnswer: "have been" });
    expect(solved.background.some((write) => write.kind === "items")).toBe(false);
    expect(practiceStep(drain(solved))).toEqual({
      kind: "review",
      request: reviewRequest(solved.work!.exercise!, "have been"),
    });
  });

  it("rejects a choose whose review says singleAnswer false and never saves it", () => {
    const reviewed = apply(
      created,
      {
        type: "exercise_written",
        draft: exerciseDraftWith({ exercise: exerciseFor("choose", 2) }),
      },
      { type: "exercise_solved", solution: solutionWith({ answer: "have been" }) },
      {
        type: "exercise_reviewed",
        review: reviewWith({ singleAnswer: false, passed: false, reason: "two forms fit" }),
      },
    );
    expect(reviewed.background.some((write) => write.kind === "items")).toBe(false);
    expect(reviewed.checks.at(-1)).toMatchObject({
      stage: "reviewer",
      passed: false,
      reason: expect.stringContaining("single_answer"),
    });
    expect(reviewed.work).toMatchObject({ attempt: 2, stage: "write" });
  });

  it("solves and reviews a choose and saves it at its position when both pass", () => {
    const passed = passSlot(created, 1);
    expect(passed.background.map((write) => write.kind)).toEqual([
      "usage",
      "usage",
      "usage",
      "items",
    ]);
    const saved = passed.background[3];
    expect(saved?.kind === "items" && saved.items).toHaveLength(1);
    expect(saved?.kind === "items" && saved.items[0]).toMatchObject({
      position: 0,
      kind: "choose",
      options: ["have been", "was", "am"],
    });
    expect(passed.checks.map((check) => [check.stage, check.passed])).toEqual([
      ["code", true],
      ["solver", true],
      ["reviewer", true],
    ]);
    expect(passed.checksDue).toBe(true);
    expect(passed.slots[0]?.position).toBe(1);
  });

  it("sends a fix to the reviewer with the solver's answer", () => {
    const state = fixSlot();
    expect(state.work?.slot).toMatchObject({ position: 2, kind: "fix" });
    const written = apply(state, {
      type: "exercise_written",
      draft: exerciseDraftWith({ exercise: exerciseFor("fix", 9) }),
    });
    const solved = apply(written, {
      type: "exercise_solved",
      solution: solutionWith({ answer: "She goes to work 9 days a week." }),
    });
    expect(workOf(solved).work).toMatchObject({
      stage: "review",
      solverAnswer: "She goes to work 9 days a week.",
    });
    expect(practiceStep(drain(solved))).toEqual({
      kind: "review",
      request: reviewRequest(solved.work!.exercise!, "She goes to work 9 days a week."),
    });
  });

  it("saves a fix the reviewer passes", () => {
    const passed = passSlot(fixSlot(), 9);
    const saved = passed.background.find((write) => write.kind === "items");
    expect(saved?.kind === "items" && saved.items[0]).toMatchObject({ position: 2, kind: "fix" });
    expect(passed.checks.map((check) => check.stage)).toEqual(["code", "solver", "reviewer"]);
    expect(passed.checks.every((check) => check.passed)).toBe(true);
  });

  it("rejects a review whose model said passed with a false boolean", () => {
    const state = fixSlot();
    const solved = apply(
      state,
      {
        type: "exercise_written",
        draft: exerciseDraftWith({ exercise: exerciseFor("fix", 9) }),
      },
      {
        type: "exercise_solved",
        solution: solutionWith({ answer: "She goes to work 9 days a week." }),
      },
      { type: "exercise_reviewed", review: reviewWith({ meaningKept: false, passed: true }) },
    );
    expect(solved.background.some((write) => write.kind === "items")).toBe(false);
    expect(solved.checks[2]).toMatchObject({
      stage: "reviewer",
      passed: false,
      reason: "meaning_kept",
    });
    expect(solved.work).toMatchObject({ attempt: 2, stage: "write" });
  });

  it("writes the slot again after a code rejection, recording the code row", () => {
    const wrong = exerciseFor("fix", 1);
    const rejected = apply(created, {
      type: "exercise_written",
      draft: exerciseDraftWith({ exercise: wrong }),
    });
    expect(rejected.checks).toHaveLength(1);
    expect(rejected.checks[0]).toMatchObject({
      stage: "code",
      passed: false,
      reason: "wrong_kind",
    });
    expect(rejected.checksDue).toBe(true);
    expect(rejected.work).toMatchObject({ attempt: 2, stage: "write", rejected: [wrong.prompt] });
    const step = practiceStep(drain(rejected));
    const turn = step.kind === "exercise" ? JSON.parse(step.request.turns[0]?.text ?? "{}") : {};
    expect(turn).not.toHaveProperty("avoid");
  });

  it("writes the slot again after a solver mismatch and an already-correct fix", () => {
    const mismatch = apply(
      created,
      {
        type: "exercise_written",
        draft: exerciseDraftWith({ exercise: exerciseFor("choose", 1) }),
      },
      { type: "exercise_solved", solution: solutionWith({ answer: "was" }) },
    );
    expect(mismatch.checks[1]).toMatchObject({
      stage: "solver",
      passed: false,
      reason: "solver_mismatch",
      solverAnswer: "was",
    });
    expect(mismatch.work).toMatchObject({ attempt: 2, stage: "write" });

    const already = apply(
      fixSlot(),
      {
        type: "exercise_written",
        draft: exerciseDraftWith({ exercise: exerciseFor("fix", 9) }),
      },
      {
        type: "exercise_solved",
        solution: solutionWith({ answer: "She go to work 9 days a week.", alreadyCorrect: true }),
      },
    );
    expect(already.checks[1]).toMatchObject({ passed: false, reason: "solver_already_correct" });
    expect(already.work).toMatchObject({ attempt: 2, stage: "write" });
  });

  it("counts a bad_response from the writer as a failed attempt with no check row", () => {
    const usage = exerciseDraftWith().usage;
    const failed = apply(created, {
      type: "exercise_failed",
      failure: aiFailure("bad_response"),
      usage,
    });
    expect(failed.checks).toEqual([]);
    expect(failed.work).toMatchObject({ attempt: 2, stage: "write" });
    expect(failed.background).toEqual([
      { kind: "usage", usage: { model: PRACTICE_WRITER_MODEL, ...usage } },
    ]);
    const refused = apply(created, { type: "exercise_failed", failure: aiFailure("refused") });
    expect(refused.work).toMatchObject({ attempt: 2 });
    expect(refused.background).toEqual([]);
  });

  it("does not use up an attempt on a key or network failure", () => {
    const failed = apply(created, { type: "exercise_failed", failure: aiFailure("network") });
    expect(failed.work).toMatchObject({ attempt: 1, stage: "write" });
    expect(failed.failure).toEqual(aiFailure("network"));
    expect(practiceStep(failed)).toEqual({ kind: "none" });
    expect(practiceRetryKind(failed)).toBe("resend");
    expect(practiceStep(apply(failed, { type: "retry" })).kind).toBe("exercise");
  });

  it("switches a fix slot to choose after its third failed attempt", () => {
    const failed = failTimes(fixSlot(), 3);
    expect(failed.failure).toBeNull();
    expect(failed.held).toBeNull();
    expect(failed.work).toMatchObject({ attempt: 1, stage: "write", slot: { kind: "choose" } });
    expect(failed.work?.rejected).toEqual([]);
    const step = practiceStep(drain(failed));
    const turn = step.kind === "exercise" ? JSON.parse(step.request.turns[0]?.text ?? "{}") : {};
    expect(turn.kind).toBe("choose");
  });

  it("keeps the rejected prompts when the slot switches kind", () => {
    const wrong = exerciseFor("choose", 1);
    const rejected = apply(fixSlot(), {
      type: "exercise_written",
      draft: exerciseDraftWith({ exercise: wrong }),
    });
    const switched = failTimes(rejected, 2);
    expect(switched.work).toMatchObject({ attempt: 1, slot: { kind: "choose" } });
    expect(switched.work?.rejected).toEqual([wrong.prompt]);
  });

  it("never falls back to translate and tries choose, gap and fix in that order", () => {
    const afterChoose = failTimes(created, 3);
    expect(afterChoose.work).toMatchObject({ attempt: 1, slot: { kind: "gap" } });
    const afterGap = failTimes(afterChoose, 3);
    expect(afterGap.work).toMatchObject({ attempt: 1, slot: { kind: "fix" } });
  });

  it("after every kind of the slot is exhausted shows the AI failure with Try again", () => {
    const failed = failTimes(created, 18);
    expect(failed.failure).toEqual({
      source: "ai",
      failure: "bad_response",
      cause: { name: "PracticeChecks", detail: null },
    });
    expect(practiceRetryKind(failed)).toBe("resend");
    expect(practiceStep(failed)).toEqual({ kind: "none" });
  });

  it("shows the AI failure after a fix slot exhausts fix, choose and gap", () => {
    expect(failTimes(fixSlot(), 17).failure).toBeNull();
    const failed = failTimes(fixSlot(), 18);
    expect(failed.failure).toMatchObject({ source: "ai", cause: { name: "PracticeChecks" } });
    expect(practiceStep(failed)).toEqual({ kind: "none" });
  });

  it("Try again after every kind is exhausted writes the slot from its planned kind", () => {
    const failed = failTimes(fixSlot(), 18);
    const retried = apply(failed, { type: "retry" });
    expect(retried.failure).toBeNull();
    expect(retried.work).toMatchObject({
      attempt: 1,
      stage: "write",
      slot: { kind: "fix" },
      tried: [],
    });
    const again = failTimes(retried, 3);
    expect(again.failure).toBeNull();
    expect(again.work).toMatchObject({ attempt: 1, slot: { kind: "choose" } });
    const step = practiceStep(retried);
    const turn = step.kind === "exercise" ? JSON.parse(step.request.turns[0]?.text ?? "{}") : {};
    expect(turn.kind).toBe("fix");
  });

  it("saves the usage of every solver and reviewer call with its model", () => {
    const passed = passSlot(fixSlot(), 9);
    const usages = passed.background.filter((write) => write.kind === "usage");
    expect(usages.map((write) => write.kind === "usage" && write.usage.model)).toEqual([
      PRACTICE_WRITER_MODEL,
      PRACTICE_SOLVER_MODEL,
      PRACTICE_REVIEW_MODEL,
    ]);
    const spent = [exerciseDraftWith(), solutionWith(), reviewWith()].reduce(
      (sum, call) => sum + usageCostUsd(call.model, call.usage),
      0,
    );
    expect(passed.spentUsd).toBeCloseTo(spent, 8);
  });

  it("saves the usage of a billed solver failure with the solver model", () => {
    const written = apply(created, {
      type: "exercise_written",
      draft: exerciseDraftWith({ exercise: exerciseFor("choose", 1) }),
    });
    const usage = solutionWith().usage;
    const failed = apply(written, {
      type: "solve_failed",
      failure: aiFailure("bad_response"),
      usage,
    });
    expect(failed.background.at(-1)).toEqual({
      kind: "usage",
      usage: { model: PRACTICE_SOLVER_MODEL, ...usage },
    });
    expect(failed.work).toMatchObject({ attempt: 2, stage: "write" });
  });

  it("holds a reviewer failure at its stage", () => {
    const written = apply(
      fixSlot(),
      {
        type: "exercise_written",
        draft: exerciseDraftWith({ exercise: exerciseFor("fix", 9) }),
      },
      {
        type: "exercise_solved",
        solution: solutionWith({ answer: "She goes to work 9 days a week." }),
      },
      { type: "review_failed", failure: aiFailure("network") },
    );
    expect(written.work).toMatchObject({ stage: "review", attempt: 1 });
    expect(written.failure).toEqual(aiFailure("network"));
  });

  it("ignores a result for a stage that is not being worked", () => {
    const solved = apply(created, { type: "exercise_solved", solution: solutionWith() });
    expect(solved).toBe(created);
  });
});

describe("one exercise ahead", () => {
  const onScreen = () => drain(passSlot(created, 1));

  it("shows the first exercise as soon as it is saved", () => {
    const passed = passSlot(created, 1);
    expect(passed.phase).toBe("asking");
    expect(runBody(passed)).toBe("generating");
    const saved = drain(passed);
    expect(saved.phase).toBe("answering");
    expect(runBody(saved)).toBe("exercise");
    expect(currentItem(saved)?.id).toBe("item-0");
  });

  it("writes slot N+1 while the learner answers N", () => {
    const state = onScreen();
    const step = practiceStep(state);
    expect(step.kind).toBe("exercise");
    expect(state.work?.slot.position).toBe(1);
    const turn = step.kind === "exercise" ? JSON.parse(step.request.turns[0]?.text ?? "{}") : {};
    expect(turn.kind).toBe("gap");
    expect(turn).not.toHaveProperty("avoid");
  });

  it("stops writing once one exercise is ready ahead", () => {
    const state = drain(passSlot(onScreen(), 2));
    expect(state.items.map((entry) => entry.correct)).toEqual([null, null]);
    expect(state.work).toBeNull();
    expect(practiceStep(state)).toEqual({ kind: "none" });
  });

  it("draws generating only when the next exercise is not ready", () => {
    const ready = drain(passSlot(onScreen(), 2));
    const afterReady = apply(
      ready,
      { type: "picked", option: "have been" },
      { type: "write_done" },
      { type: "continue" },
    );
    expect(afterReady.phase).toBe("answering");
    expect(currentItem(afterReady)?.id).toBe("item-1");
    expect(runBody(afterReady)).toBe("exercise");

    const notReady = apply(
      onScreen(),
      { type: "picked", option: "have been" },
      { type: "write_done" },
      { type: "continue" },
    );
    expect(notReady.phase).toBe("asking");
    expect(runBody(notReady)).toBe("generating");
  });

  it("puts the screen's answer write before the background write", () => {
    const queued = passSlot(onScreen(), 2);
    expect(queued.background.length).toBeGreaterThan(0);
    const picked = apply(queued, { type: "picked", option: "have been" });
    const step = practiceStep(picked);
    expect(step).toMatchObject({ kind: "write", lane: "screen", write: { kind: "answer" } });
  });

  it("a background write_done pops only the background queue", () => {
    const picked = apply(passSlot(onScreen(), 2), { type: "picked", option: "have been" });
    const next = apply(picked, { type: "write_done", lane: "background" });
    expect(next.background).toHaveLength(picked.background.length - 1);
    expect(next.writes).toEqual(picked.writes);
    expect(practiceStep(next)).toMatchObject({ kind: "write", lane: "screen" });
  });

  it("a background write_done keeps the screen grading and on the sheet", () => {
    const typed = resumed(practiceTodayWith([typedItem(0)], { target: 5 }));
    const queued = passSlot(typed, 1);
    const grading = apply(
      queued,
      { type: "draft_changed", text: "I have never visited Japan." },
      { type: "check_started" },
    );
    expect(grading.phase).toBe("grading");
    let state = grading;
    while (state.background.length > 0) {
      const head = state.background[0];
      state = apply(state, {
        type: "write_done",
        lane: "background",
        items: head?.kind === "items" ? [typedItem(0), item(1, null, head.items[0])] : undefined,
      });
    }
    expect(state.phase).toBe("grading");
    expect(state.items.map((entry) => entry.id)).toEqual(["item-0", "item-1"]);

    const sheet = apply(
      resumed(practiceTodayWith([item(0)], { target: 5 })),
      { type: "picked", option: "was" },
      { type: "write_done" },
    );
    expect(sheet.phase).toBe("feedback");
    const afterBackground = apply(sheet, { type: "write_done", lane: "background" });
    expect(afterBackground.phase).toBe("feedback");
  });

  it("keeps a local answer when a background save returns the item unanswered", () => {
    const state = passSlot(onScreen(), 2);
    const answered = apply(state, { type: "picked", option: "was" });
    let merged = answered;
    while (merged.background.length > 0) {
      const head = merged.background[0];
      merged = apply(merged, {
        type: "write_done",
        lane: "background",
        items: head?.kind === "items" ? [item(0), item(1, null, head.items[0])] : undefined,
      });
    }
    expect(merged.items[0]).toMatchObject({ correct: false, userAnswer: "was" });
    expect(merged.items).toHaveLength(2);
  });

  it("grades before the next background AI step", () => {
    const typed = resumed(practiceTodayWith([typedItem(0)], { target: 5 }));
    expect(typed.work?.stage).toBe("write");
    const grading = apply(
      typed,
      { type: "draft_changed", text: "I have never visited Japan." },
      { type: "check_started" },
    );
    expect(practiceStep(grading).kind).toBe("grade");
  });

  it("holds a background AI failure until the learner waits for that slot", () => {
    const state = onScreen();
    const held = apply(state, { type: "exercise_failed", failure: aiFailure("network") });
    expect(held.held).toEqual(aiFailure("network"));
    expect(held.failure).toBeNull();
    expect(held.phase).toBe("answering");
    expect(practiceStep(held)).toEqual({ kind: "none" });
    const waiting = apply(
      held,
      { type: "picked", option: "have been" },
      { type: "write_done" },
      { type: "continue" },
    );
    expect(waiting.phase).toBe("asking");
    expect(waiting.failure).toEqual(aiFailure("network"));
    expect(waiting.held).toBeNull();
    const retried = apply(waiting, { type: "retry" });
    expect(practiceStep(retried).kind).toBe("exercise");
  });

  it("shows a background failure at once when the learner is waiting", () => {
    const failed = apply(created, { type: "exercise_failed", failure: aiFailure("network") });
    expect(failed.failure).toEqual(aiFailure("network"));
    expect(failed.held).toBeNull();
  });

  it("holds the exhausted slot's failure until the learner waits", () => {
    const failed = failTimes(onScreen(), 18);
    expect(failed.failure).toBeNull();
    expect(failed.held).toMatchObject({ source: "ai", cause: { name: "PracticeChecks" } });
  });
});

describe("leaving the run", () => {
  const left = () => apply(created, { type: "left" });

  it("finishes the call in flight, saves its usage and starts no other call", () => {
    const written = apply(left(), {
      type: "exercise_written",
      draft: exerciseDraftWith({ exercise: exerciseFor("choose", 1) }),
    });
    expect(written.work?.stage).toBe("solve");
    expect(written.background.some((write) => write.kind === "usage")).toBe(true);
    const saved = drain(written);
    expect(saved.background).toEqual([]);
    expect(practiceStep(saved)).toEqual({ kind: "none" });
  });

  it("schedules no new slot when the slot in flight passes", () => {
    const passed = drain(passSlot(left(), 1));
    expect(passed.work).toBeNull();
    expect(passed.slots.length).toBeGreaterThan(0);
    expect(passed.items).toHaveLength(1);
    expect(practiceStep(passed)).toEqual({ kind: "none" });
  });

  it("sends no grade call after leaving", () => {
    const typed = resumed(practiceTodayWith([typedItem(0)], { target: 5 }));
    const grading = apply(
      typed,
      { type: "draft_changed", text: "I have never visited Japan." },
      { type: "check_started" },
      { type: "left" },
    );
    expect(grading.phase).toBe("grading");
    expect(practiceStep(grading)).toEqual({ kind: "none" });
  });
});

describe("the checks save", () => {
  function writesDone(state: PracticeRunState): PracticeRunState {
    let current = state;
    while (practiceStep(current).kind === "write") {
      current = apply(current, { type: "write_done", lane: "background", items: [item(0)] });
    }
    return current;
  }

  it("sends the checks after the passed item's save", () => {
    const passed = passSlot(created, 1);
    expect(practiceStep(passed).kind).toBe("write");
    const step = practiceStep(writesDone(passed));
    expect(step).toMatchObject({ kind: "checks" });
    expect(step.kind === "checks" && step.checks.map((check) => check.stage)).toEqual([
      "code",
      "solver",
      "reviewer",
    ]);
  });

  it("sends the checks right after a rejection", () => {
    const rejected = apply(created, {
      type: "exercise_written",
      draft: exerciseDraftWith({ exercise: exerciseFor("fix", 1) }),
    });
    const step = practiceStep(writesDone(rejected));
    expect(step.kind === "checks" && step.checks[0]).toMatchObject({
      stage: "code",
      passed: false,
    });
  });

  it("keeps the checks and goes on when their save fails", () => {
    const rejected = writesDone(
      apply(created, {
        type: "exercise_written",
        draft: exerciseDraftWith({ exercise: exerciseFor("fix", 1) }),
      }),
    );
    const failed = apply(rejected, { type: "checks_failed" });
    expect(failed.failure).toBeNull();
    expect(failed.checks).toHaveLength(1);
    expect(failed.checksDue).toBe(false);
    expect(practiceStep(failed).kind).toBe("exercise");
  });

  it("sends the kept checks with the next save", () => {
    const kept = apply(
      writesDone(
        apply(created, {
          type: "exercise_written",
          draft: exerciseDraftWith({ exercise: exerciseFor("fix", 1) }),
        }),
      ),
      { type: "checks_failed" },
    );
    const next = writesDone(
      apply(kept, {
        type: "exercise_written",
        draft: exerciseDraftWith({ exercise: exerciseFor("fix", 2) }),
      }),
    );
    const step = practiceStep(next);
    expect(step.kind === "checks" && step.checks).toHaveLength(2);
  });

  it("drops the saved rows and keeps checksDue only while rows are left", () => {
    const rows = Array.from({ length: 3 }, () =>
      codeRow({ generatorModel: TUTOR_MODEL, exercise: exerciseFor("choose", 1), reason: null }),
    );
    const state = { ...created, checks: rows, checksDue: true };
    const some = apply(state, { type: "checks_saved", count: 2 });
    expect(some.checks).toHaveLength(1);
    expect(some.checksDue).toBe(true);
    const all = apply(state, { type: "checks_saved", count: 3 });
    expect(all.checks).toEqual([]);
    expect(all.checksDue).toBe(false);
  });

  it("sends at most twenty rows at a time", () => {
    const rows = Array.from({ length: 25 }, () =>
      codeRow({ generatorModel: TUTOR_MODEL, exercise: exerciseFor("choose", 1), reason: null }),
    );
    const state = { ...created, checks: rows, checksDue: true };
    const step = practiceStep(state);
    expect(step.kind === "checks" && step.checks).toHaveLength(20);
    const after = apply(state, { type: "checks_saved", count: 20 });
    expect(after.checks).toHaveLength(5);
    expect(after.checksDue).toBe(true);
  });
});

describe("the grader", () => {
  const grading = () =>
    apply(
      answering([0, 1, 2, 3].map((p) => item(p, true)).concat(typedItem(4))),
      { type: "draft_changed", text: "I have never visited Japan." },
      { type: "check_started" },
    );

  it("records a grader check passed false and keeps the verdict correct on a flawed grade", () => {
    const state = apply(grading(), {
      type: "grade_received",
      grade: answerGradeWith({ correct: false, flawed: true, explanation: "Two answers fit." }),
    });
    expect(state.items[4]).toMatchObject({ correct: true });
    expect(state.checks.at(-1)).toMatchObject({
      stage: "grader",
      passed: false,
      reason: "grader_flawed",
      checkerModel: TUTOR_MODEL,
    });
    expect(state.checksDue).toBe(true);
  });

  it("records a grader check passed true on a normal grade", () => {
    const state = apply(grading(), {
      type: "grade_received",
      grade: answerGradeWith({ correct: false, flawed: false }),
    });
    expect(state.items[4]).toMatchObject({ correct: false });
    expect(state.checks.at(-1)).toMatchObject({ stage: "grader", passed: true, reason: null });
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
      lane: "screen",
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
    expect(practiceStep(state)).toEqual({
      kind: "write",
      lane: "screen",
      write: { kind: "finish" },
    });
  });

  it("finishes the run with no offer when nothing was missed", () => {
    const state = apply(
      lastOfFive(false),
      { type: "picked", option: "have been" },
      { type: "write_done" },
      { type: "continue" },
    );
    expect(state.phase).toBe("finishing");
    expect(practiceStep(state)).toEqual({
      kind: "write",
      lane: "screen",
      write: { kind: "finish" },
    });
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
    expect(practiceStep(state)).toEqual({
      kind: "write",
      lane: "screen",
      write: { kind: "target", target: 10 },
    });
    const saved = apply(state, { type: "write_done", run: practiceRunWith({ target: 10 }) });
    expect(saved.phase).toBe("asking");
    expect(practiceStep(saved)).toEqual({
      kind: "exercise",
      request: exerciseRequest({
        slot: saved.slots[0]!,
        missedRules: ["Present perfect"],
        language: null,
        seed: saved.work?.seed ?? null,
      }),
    });
    expect(saved.slots[0]?.position).toBe(5);
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
    expect(practiceStep(state)).toEqual({
      kind: "write",
      lane: "screen",
      write: { kind: "finish" },
    });
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
  it("does not start a slot while the spend is blocked but still saves its writes", () => {
    const state = apply(fresh({ spentUsd: 10 }), { type: "write_done", run: practiceRunWith() });
    expect(sendState(state).locked).toBe(true);
    expect(state.work).toBeNull();
    expect(practiceStep(state)).toEqual({ kind: "none" });
    const usage = {
      model: TUTOR_MODEL,
      inputTokens: 1,
      outputTokens: 1,
      cacheCreationInputTokens: 0,
      cacheReadInputTokens: 0,
    } as const;
    const queued = { ...state, background: [{ kind: "usage" as const, usage }] };
    expect(practiceStep(queued)).toEqual({
      kind: "write",
      lane: "background",
      write: { kind: "usage", usage },
    });
  });

  it("warns at 80% and keeps asking", () => {
    const state = apply(fresh({ spentUsd: 8 }), { type: "write_done", run: practiceRunWith() });
    expect(sendState(state)).toEqual({ locked: false, notice: "warning" });
    expect(practiceStep(state).kind).toBe("exercise");
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
    expect(practiceStep(state)).toMatchObject({ kind: "write", lane: "screen" });
  });

  it("locks the run for an OpenAI provider", () => {
    const state = startPractice({
      origin: { kind: "new", input: { focus: "mistakes", target: 5 } },
      opened: null,
      profile: { ...profile, provider: "openai" },
      spentUsd: 0,
      focus,
      language: null,
      recent: [],
    });
    expect(sendState(state)).toEqual({ locked: true, notice: "unsupported" });
  });

  it("refreshes the context and clears a key failure", () => {
    const failed = apply(created, {
      type: "exercise_failed",
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
    expect(practiceStep(refreshed).kind).toBe("exercise");
  });

  it("also clears a held key failure", () => {
    const held = apply(drain(passSlot(created, 1)), {
      type: "exercise_failed",
      failure: { source: "ai", failure: "invalid_key" },
    });
    expect(held.held).not.toBeNull();
    const refreshed = apply(held, {
      type: "context_refreshed",
      provider: "claude",
      limitUsd: 10,
      spentUsd: 1,
    });
    expect(refreshed.held).toBeNull();
    expect(practiceStep(refreshed).kind).toBe("exercise");
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
