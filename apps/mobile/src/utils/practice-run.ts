import {
  PRACTICE_REVIEW_MODEL,
  PRACTICE_SOLVER_MODEL,
  PRACTICE_WRITER_MODEL,
  TUTOR_MODEL,
  usageCostUsd,
  type ModelId,
  type PracticeAnswer,
  type PracticeCheckCreate,
  type PracticeItem,
  type PracticeItemCreate,
  type PracticeRun,
  type PracticeRunCreate,
  type PracticeRunWithItems,
  type Profile,
  type Provider,
  type RecentPrompt,
  type SessionUsage,
  type StudyNoteCreate,
  type TokenUsage,
} from "@fluency-lab/shared";

import type {
  AnswerGrade,
  ExerciseReview,
  ExerciseSolution,
  PracticeExercise,
  PracticeExerciseDraft,
  StudyNoteReply,
  TutorRequest,
} from "@/ai/ai-port";
import { round8, sendState, usageWrite, withContext } from "@/utils/chat-conversation";
import type { ContextEvent } from "@/utils/chat-conversation";
import type { ChatFailure } from "@/utils/chat-failure";
import { gradeChoice, gradedCorrect, localGrade } from "@/utils/practice-grade";
import { keepGoingTarget, missedRules, practiceNext } from "@/utils/practice-escalation";
import type { PracticeOrigin } from "@/utils/practice-focus";
import {
  codeCheck,
  codeRow,
  graderRow,
  reviewVerdict,
  reviewerRow,
  solverRow,
  solverVerdict,
} from "@/utils/practice-check";
import {
  KIND_LABELS,
  avoidPrompts,
  exerciseRequest,
  gradeRequest,
  reviewRequest,
  solveRequest,
  studyNoteRequest,
  type FocusData,
} from "@/utils/practice-prompt";
import { gapSentenceFill, splitGap } from "@/utils/practice-round";
import {
  MAX_SLOT_ATTEMPTS,
  missingPositions,
  planSlots,
  type PracticeSlot,
} from "@/utils/practice-slots";

export type PracticeWrite =
  | { kind: "create"; input: PracticeRunCreate }
  | { kind: "items"; items: PracticeItemCreate[] }
  | { kind: "usage"; usage: SessionUsage }
  | { kind: "note"; input: StudyNoteCreate }
  | { kind: "answer"; itemId: string; answer: PracticeAnswer }
  | { kind: "target"; target: 10 | 15 }
  | { kind: "finish" };

// INFO: the screen lane holds the writes the learner waits on; the background lane holds the
// writes of the slot being prepared. A background write never takes or reorders a screen write.
export type WriteLane = "screen" | "background";

// INFO: the slot being written and checked. attempt counts the failed checks of the slot; stage
// is the call it waits for. rejected holds the prompts the code check or a later check refused.
// tried holds the kinds the slot already used up, the planned kind first; slot.kind is the
// kind being written now.
export type SlotWork = {
  slot: PracticeSlot;
  tried: PracticeSlot["kind"][];
  attempt: number;
  stage: "write" | "solve" | "review";
  exercise: PracticeExercise | null;
  generatorModel: ModelId;
  solverAnswer: string | null;
  rejected: string[];
};

export type PracticePhase =
  "creating" | "asking" | "answering" | "grading" | "feedback" | "saving" | "result" | "finishing";

export type Feedback = {
  tone: "right" | "miss";
  title: string;
  // INFO: the first accepted answer, shown on a miss only.
  answer: string | null;
  explanation: string;
  itemId: string;
};

// INFO: the study note asked for from a missed item: asking the tutor, saving the note, or failed
// (the sheet stays and Try again asks again).
export type NoteRequest = { itemId: string; status: "asking" | "saving" | "failed" };

export type PracticeRunState = {
  origin: PracticeOrigin;
  run: PracticeRun | null;
  items: PracticeItem[];
  focus: FocusData;
  language: string | null;
  // INFO: the caller's recent items from the last days, newest first, read once when the run opens.
  recent: RecentPrompt[];
  displayName: string | null;
  draft: string;
  picked: string | null;
  feedback: Feedback | null;
  noteRequest: NoteRequest | null;
  // INFO: the id of a note that was just saved, which the screen opens; cleared once opened.
  openNote: string | null;
  phase: PracticePhase;
  // INFO: the writes the screen waits on, in order.
  writes: PracticeWrite[];
  // INFO: the writes of the slot being prepared (the passed item, usage of its calls), in order.
  background: PracticeWrite[];
  // INFO: one slot per position still to fill; the first is the one being worked.
  slots: PracticeSlot[];
  work: SlotWork | null;
  // INFO: an AI failure of the background chain, kept until the learner waits for that exercise.
  held: ChatFailure | null;
  // INFO: the checks not saved yet, and whether the next step should send them. A failed save
  // keeps the rows and clears checksDue; the next row added sets it again.
  checks: PracticeCheckCreate[];
  checksDue: boolean;
  // INFO: the learner left the run (Stop practice or the screen is gone). A call in flight finishes
  // and its usage is saved, but no new slot is scheduled and no new AI call starts.
  stopped: boolean;
  failure: ChatFailure | null;
  provider: Provider | null;
  limitUsd: number | null;
  spentUsd: number;
};

export type PracticeEvent =
  | { type: "draft_changed"; text: string }
  | { type: "picked"; option: string }
  | { type: "check_started" }
  | { type: "exercise_written"; draft: PracticeExerciseDraft }
  // INFO: usage is present when the provider answered and billed a call that was not usable.
  | { type: "exercise_failed"; failure: ChatFailure; usage?: TokenUsage }
  | { type: "exercise_solved"; solution: ExerciseSolution }
  | { type: "solve_failed"; failure: ChatFailure; usage?: TokenUsage }
  | { type: "exercise_reviewed"; review: ExerciseReview }
  | { type: "review_failed"; failure: ChatFailure; usage?: TokenUsage }
  | { type: "checks_saved"; count: number }
  | { type: "checks_failed" }
  | { type: "grade_received"; grade: AnswerGrade }
  | { type: "grade_failed"; failure: ChatFailure; usage?: AnswerGrade["usage"] }
  // INFO: run follows a create, target or finish write; items follow an items write (every item of the run).
  // lane is the lane of the write that finished; the screen lane is the default.
  | { type: "note_requested" }
  | { type: "note_received"; note: StudyNoteReply }
  // INFO: usage is present when the provider answered and billed a note that was not usable.
  | { type: "note_failed"; failure: ChatFailure; usage?: StudyNoteReply["usage"] }
  | { type: "note_opened" }
  // INFO: noteId follows a note write.
  | {
      type: "write_done";
      lane?: WriteLane;
      run?: PracticeRun;
      items?: PracticeItem[];
      noteId?: string;
    }
  | { type: "write_failed"; failure: ChatFailure; lane?: WriteLane }
  | { type: "continue" }
  | { type: "keep_going" }
  | { type: "finish_requested" }
  | { type: "retry" }
  | { type: "left" }
  | ContextEvent;

export type PracticeStep =
  | { kind: "none" }
  | { kind: "write"; write: PracticeWrite; lane: WriteLane }
  | { kind: "checks"; checks: PracticeCheckCreate[] }
  | { kind: "exercise"; request: TutorRequest }
  | { kind: "solve"; request: TutorRequest }
  | { kind: "review"; request: TutorRequest }
  | { kind: "grade"; request: TutorRequest }
  | { kind: "note"; request: TutorRequest };

export type SegmentState = "done" | "missed" | "current" | "pending";

export type ExerciseView = {
  kindLabel: string;
  rule: string;
  prompt: string;
  gap: { before: string; after: string } | null;
  // INFO: the sentence to fix, with a label when it comes from the learner's chat.
  card: { label: string | null; text: string } | null;
  typed: boolean;
};

const MAX_CHECK_ROWS = 20;

// INFO: the failure after the last attempt of a slot: today's AI failure with Try again.
const EXHAUSTED: ChatFailure = {
  source: "ai",
  failure: "bad_response",
  cause: { name: "PracticeChecks", detail: null },
};

export const RIGHT_TITLE = "Nice one!";
export const MISS_TITLE = "Not quite";
export const SOURCE_LABEL = "From your chat";

export function startPractice(input: {
  origin: PracticeOrigin;
  opened: PracticeRunWithItems | null;
  profile: Profile;
  spentUsd: number;
  focus: FocusData;
  language: string | null;
  recent: RecentPrompt[];
}): PracticeRunState {
  const { origin, opened, profile } = input;
  const base: PracticeRunState = {
    origin,
    run: opened?.run ?? null,
    items: opened?.items ?? [],
    focus: input.focus,
    language: input.language,
    recent: input.recent,
    displayName: profile.displayName,
    draft: "",
    picked: null,
    feedback: null,
    noteRequest: null,
    openNote: null,
    phase: "creating",
    writes:
      origin.kind === "new" && opened === null ? [{ kind: "create", input: origin.input }] : [],
    background: [],
    slots:
      opened === null
        ? []
        : planSlots({
            positions: missingPositions(opened.items, opened.run.target),
            focus: input.focus,
            language: input.language,
            usedRules: opened.items.map((entry) => entry.rule),
          }),
    work: null,
    held: null,
    checks: [],
    checksDue: false,
    stopped: false,
    failure: null,
    provider: profile.provider,
    limitUsd: profile.monthlyLimitUsd,
    spentUsd: input.spentUsd,
  };
  return schedule(base.writes.length > 0 ? base : settle(base));
}

// INFO: where a run with no write pending goes next, from its items.
function settle(s: PracticeRunState): PracticeRunState {
  if (s.run === null) return { ...s, phase: "creating" };
  const next = practiceNext(s.items, s.run.target);
  if (next === "answer") return { ...s, phase: "answering" };
  if (next === "ask") return surface({ ...s, phase: "asking" });
  if (next === "offer") return { ...s, phase: "result" };
  // INFO: with no offer the run ends as soon as the result shows.
  if (s.run.finishedAt === null) {
    return { ...s, writes: [...s.writes, { kind: "finish" }], phase: "finishing" };
  }
  return { ...s, phase: "result" };
}

// INFO: a held background failure shows once the learner is waiting for the exercise.
function surface(s: PracticeRunState): PracticeRunState {
  return s.phase === "asking" && s.held !== null ? { ...s, failure: s.held, held: null } : s;
}

// INFO: a background failure shows at once when the learner is waiting, and is held otherwise.
function hold(s: PracticeRunState, failure: ChatFailure): PracticeRunState {
  return s.phase === "asking" ? { ...s, failure } : { ...s, held: failure };
}

// INFO: the exercises ahead of the learner: unanswered and saved, plus queued for saving.
function ahead(s: PracticeRunState): number {
  const queued = s.background.filter((write) => write.kind === "items").length;
  return s.items.filter((entry) => entry.correct === null).length + queued;
}

// INFO: starts the next slot when fewer than two exercises are ahead of the learner, so the
// first shows as soon as it passes and slot N+1 is written while N is answered.
function schedule(s: PracticeRunState): PracticeRunState {
  const slot = s.slots[0];
  if (s.run === null || s.work !== null || slot === undefined || s.stopped) return s;
  if (s.phase === "result" || s.phase === "finishing" || sendState(s).locked) return s;
  if (ahead(s) > 1) return s;
  return {
    ...s,
    work: {
      slot,
      tried: [],
      attempt: 1,
      stage: "write",
      exercise: null,
      generatorModel: PRACTICE_WRITER_MODEL,
      solverAnswer: null,
      rejected: [],
    },
  };
}

function afterWrites(s: PracticeRunState): PracticeRunState {
  return s.feedback === null ? settle(s) : { ...s, phase: "feedback" };
}

export function currentItem(s: PracticeRunState): PracticeItem | null {
  if (s.feedback !== null) {
    const answered = s.feedback.itemId;
    return s.items.find((item) => item.id === answered) ?? null;
  }
  return s.items.find((item) => item.correct === null) ?? null;
}

function withCost<T extends PracticeRunState>(
  s: T,
  model: SessionUsage["model"],
  usage: TokenUsage,
): T {
  return { ...s, spentUsd: round8(s.spentUsd + usageCostUsd(model, usage)) };
}

function answerItem(
  s: PracticeRunState,
  item: PracticeItem,
  verdict: { correct: boolean; userAnswer: string; explanation: string },
  extra: PracticeWrite[],
): PracticeRunState {
  const feedback: Feedback = verdict.correct
    ? {
        tone: "right",
        title: RIGHT_TITLE,
        answer: null,
        explanation: verdict.explanation,
        itemId: item.id,
      }
    : {
        tone: "miss",
        title: MISS_TITLE,
        answer: item.accepted[0] ?? "",
        explanation: verdict.explanation,
        itemId: item.id,
      };
  return {
    ...s,
    items: s.items.map((entry) =>
      entry.id === item.id
        ? { ...entry, correct: verdict.correct, userAnswer: verdict.userAnswer }
        : entry,
    ),
    picked: item.kind === "choose" ? verdict.userAnswer : null,
    feedback,
    failure: null,
    writes: [
      ...s.writes,
      {
        kind: "answer",
        itemId: item.id,
        answer: { userAnswer: verdict.userAnswer, correct: verdict.correct },
      },
      ...extra,
    ],
    phase: "saving",
  };
}

function withUsageWrite(
  s: PracticeRunState,
  failure: ChatFailure,
  usage: TokenUsage | undefined,
): PracticeRunState {
  const failed = { ...s, failure };
  if (usage === undefined) return failed;
  // INFO: the billed call still counts: its usage is saved and its cost added to the spend.
  return {
    ...withCost(failed, TUTOR_MODEL, usage),
    writes: [...s.writes, { kind: "usage", usage: usageWrite(TUTOR_MODEL, usage) }],
    phase: "saving",
  };
}

function applyWrite(s: PracticeRunState, event: Extract<PracticeEvent, { type: "write_done" }>) {
  const [done, ...writes] = s.writes;
  if (done === undefined) return s;
  let next: PracticeRunState = { ...s, writes };
  if (event.run !== undefined && (done.kind === "create" || done.kind === "finish")) {
    next = { ...next, run: event.run };
  }
  if (event.run !== undefined && done.kind === "target") next = { ...next, run: event.run };
  if (event.noteId !== undefined && done.kind === "note") {
    next = { ...next, openNote: event.noteId, noteRequest: null };
  }
  if (event.run !== undefined && done.kind === "create") {
    next = {
      ...next,
      slots: planSlots({
        positions: missingPositions(next.items, event.run.target),
        focus: next.focus,
        language: next.language,
        usedRules: next.items.map((entry) => entry.rule),
      }),
    };
  }
  return writes.length === 0 ? afterWrites(next) : next;
}

// INFO: a saved item returns every item of the run; the items already on screen stay as they
// are, because their answers may not be saved yet.
function mergeItems(local: PracticeItem[], saved: PracticeItem[]): PracticeItem[] {
  const known = new Set(local.map((entry) => entry.id));
  return [...local, ...saved.filter((entry) => !known.has(entry.id))].sort(
    (a, b) => a.position - b.position,
  );
}

// INFO: a background write only pops the background queue. It moves the phase only when the
// learner is waiting, so it never knocks the screen out of grading or the feedback sheet.
function applyBackground(
  s: PracticeRunState,
  event: Extract<PracticeEvent, { type: "write_done" }>,
): PracticeRunState {
  const [done, ...background] = s.background;
  if (done === undefined) return s;
  let next: PracticeRunState = { ...s, background };
  if (event.items !== undefined && done.kind === "items") {
    next = { ...next, items: mergeItems(next.items, event.items) };
  }
  return next.phase === "asking" ? settle(next) : next;
}

// INFO: a billed call counts: its usage is saved in the background lane and its cost added.
function bill(
  s: PracticeRunState,
  model: ModelId,
  usage: TokenUsage | undefined,
): PracticeRunState {
  if (usage === undefined) return s;
  return {
    ...withCost(s, model, usage),
    background: [...s.background, { kind: "usage", usage: usageWrite(model, usage) }],
  };
}

// INFO: the rows of a slot wait until the slot ends (it passes or a check rejects it), so they go
// in one save with the passed item's or right after the rejection, not one call per row.
function withRows(s: PracticeRunState, ...rows: PracticeCheckCreate[]): PracticeRunState {
  return { ...s, checks: [...s.checks, ...rows] };
}

// INFO: the slot passed: its one exercise is queued for saving at its position.
function passSlot(s: PracticeRunState, work: SlotWork, exercise: PracticeExercise) {
  const items: PracticeItemCreate[] = [{ ...exercise, position: work.slot.position }];
  return {
    ...s,
    background: [...s.background, { kind: "items" as const, items }],
    checksDue: true,
    slots: s.slots.slice(1),
    work: null,
  };
}

// INFO: the kinds a slot falls back to, in order, once its kind used up every attempt. A translate
// is never a fallback: it needs the device language and stays at most one in three.
const FALLBACK_KINDS: readonly PracticeSlot["kind"][] = ["choose", "gap", "fix"];

// INFO: the slot is written again; after the last attempt it switches to the next kind not yet
// tried, from attempt one with its rejected prompts kept. When every kind is used up the AI
// failure shows, and Try again starts the slot from its planned kind.
function failAttempt(
  s: PracticeRunState,
  work: SlotWork,
  rejectedPrompt: string | null,
): PracticeRunState {
  const rejected = rejectedPrompt === null ? work.rejected : [...work.rejected, rejectedPrompt];
  const again: SlotWork = {
    ...work,
    stage: "write",
    exercise: null,
    solverAnswer: null,
    rejected,
  };
  const due = { ...s, checksDue: true };
  if (work.attempt < MAX_SLOT_ATTEMPTS) {
    return { ...due, work: { ...again, attempt: work.attempt + 1 } };
  }
  const tried = [...work.tried, work.slot.kind];
  const next = FALLBACK_KINDS.find((kind) => !tried.includes(kind));
  if (next !== undefined) {
    return { ...due, work: { ...again, slot: { ...work.slot, kind: next }, tried, attempt: 1 } };
  }
  const planned = tried[0] ?? work.slot.kind;
  const restart: SlotWork = {
    ...again,
    slot: { ...work.slot, kind: planned },
    tried: [],
    attempt: 1,
  };
  return hold({ ...due, work: restart }, EXHAUSTED);
}

// INFO: a bad_response or a refusal is a failed attempt with no check row (there is no exercise
// to record); any other AI failure does not use up an attempt and Try again resends the stage.
function stageFailed(
  s: PracticeRunState,
  stage: SlotWork["stage"],
  model: ModelId,
  event: { failure: ChatFailure; usage?: TokenUsage },
): PracticeRunState {
  const work = s.work;
  if (work === null || work.stage !== stage) return s;
  const billed = bill(s, model, event.usage);
  const { failure } = event;
  if (
    failure.source === "ai" &&
    (failure.failure === "bad_response" || failure.failure === "refused")
  ) {
    return failAttempt(billed, work, null);
  }
  return hold(billed, failure);
}

// INFO: the prompts the writer must not repeat: the ones rejected for this slot (newest first),
// the ones queued for saving, then the run's and the recent ones.
function avoidFor(s: PracticeRunState): string[] {
  const rejected = [...(s.work?.rejected ?? [])].reverse();
  const queued = s.background.flatMap((write) =>
    write.kind === "items" ? write.items.map((entry) => entry.prompt) : [],
  );
  return avoidPrompts(s.items, s.recent, s.run?.id ?? null, [...rejected, ...queued]);
}

function reduce(s: PracticeRunState, event: PracticeEvent): PracticeRunState {
  switch (event.type) {
    case "draft_changed":
      return s.phase === "answering" ? { ...s, draft: event.text } : s;
    case "picked": {
      const item = currentItem(s);
      if (s.phase !== "answering" || item === null || item.kind !== "choose") return s;
      if (sendState(s).locked || item.options === null || !item.options.includes(event.option)) {
        return s;
      }
      const correct = gradeChoice(event.option, item.accepted);
      return answerItem(
        s,
        item,
        { correct, userAnswer: event.option, explanation: item.explanation },
        [],
      );
    }
    case "check_started": {
      const item = currentItem(s);
      const text = s.draft.trim();
      if (s.phase !== "answering" || item === null || item.kind === "choose" || text === "") {
        return s;
      }
      if (sendState(s).locked) return s;
      // INFO: a gap typed as the whole sentence with the right fill is right with no tutor call.
      const grade = gapSentenceFill(item, text) === null ? localGrade(item, text) : "right";
      if (grade === "ask") return { ...s, phase: "grading", failure: null };
      return answerItem(
        s,
        item,
        { correct: grade === "right", userAnswer: text, explanation: item.explanation },
        [],
      );
    }
    case "exercise_written": {
      const work = s.work;
      if (work === null || work.stage !== "write") return s;
      const { draft } = event;
      const billed = bill(s, draft.model, draft.usage);
      const checked = codeCheck(draft.exercise, work.slot.kind, avoidFor(s));
      const row = codeRow({
        generatorModel: draft.model,
        exercise: draft.exercise,
        reason: checked.ok ? null : checked.reason,
      });
      const recorded = withRows(billed, row);
      if (!checked.ok) return failAttempt(recorded, work, draft.exercise.prompt.trim());
      return {
        ...recorded,
        work: { ...work, stage: "solve", exercise: checked.exercise, generatorModel: draft.model },
      };
    }
    case "exercise_failed":
      return stageFailed(s, "write", PRACTICE_WRITER_MODEL, event);
    case "exercise_solved": {
      const work = s.work;
      if (work === null || work.stage !== "solve" || work.exercise === null) return s;
      const { solution } = event;
      const billed = bill(s, solution.model, solution.usage);
      const verdict = solverVerdict(work.exercise, solution);
      const recorded = withRows(
        billed,
        solverRow({
          generatorModel: work.generatorModel,
          checkerModel: solution.model,
          exercise: work.exercise,
          answer: solution.answer,
          reason: verdict.kind === "reject" ? verdict.reason : null,
        }),
      );
      if (verdict.kind === "pass") return passSlot(recorded, work, work.exercise);
      if (verdict.kind === "reject") return failAttempt(recorded, work, work.exercise.prompt);
      return {
        ...recorded,
        work: { ...work, stage: "review", solverAnswer: verdict.solverAnswer },
      };
    }
    case "solve_failed":
      return stageFailed(s, "solve", PRACTICE_SOLVER_MODEL, event);
    case "exercise_reviewed": {
      const work = s.work;
      if (work === null || work.stage !== "review" || work.exercise === null) return s;
      const { review } = event;
      const billed = bill(s, review.model, review.usage);
      const verdict = reviewVerdict(review, work.exercise.kind);
      const recorded = withRows(
        billed,
        reviewerRow({
          generatorModel: work.generatorModel,
          checkerModel: review.model,
          exercise: work.exercise,
          solverAnswer: work.solverAnswer ?? "",
          verdict,
        }),
      );
      if (verdict.passed) return passSlot(recorded, work, work.exercise);
      return failAttempt(recorded, work, work.exercise.prompt);
    }
    case "review_failed":
      return stageFailed(s, "review", PRACTICE_REVIEW_MODEL, event);
    case "checks_saved": {
      const checks = s.checks.slice(event.count);
      return { ...s, checks, checksDue: checks.length > 0 };
    }
    case "checks_failed":
      return { ...s, checksDue: false };
    case "grade_received": {
      const item = currentItem(s);
      const text = s.draft.trim();
      if (s.phase !== "grading" || item === null) return s;
      const { grade } = event;
      const explanation = grade.explanation ?? item.explanation;
      const answered = answerItem(
        s,
        item,
        { correct: gradedCorrect(grade), userAnswer: text, explanation },
        [{ kind: "usage", usage: usageWrite(grade.model, grade.usage) }],
      );
      const row = graderRow({
        generatorModel: PRACTICE_WRITER_MODEL,
        checkerModel: grade.model,
        exercise: item,
        flawed: grade.flawed,
      });
      return {
        ...withRows(withCost(answered, grade.model, grade.usage), row),
        checksDue: true,
        draft: "",
      };
    }
    case "grade_failed":
      return withUsageWrite({ ...s, phase: "answering" }, event.failure, event.usage);
    case "write_done":
      return event.lane === "background" ? applyBackground(s, event) : applyWrite(s, event);
    case "write_failed":
      return { ...s, failure: event.failure };
    case "note_requested": {
      const miss = s.feedback?.tone === "miss" && s.focus.kind !== "words";
      const inFlight = s.noteRequest !== null && s.noteRequest.status !== "failed";
      if (s.phase !== "feedback" || s.feedback === null || !miss || inFlight) return s;
      if (sendState(s).locked) return s;
      return {
        ...s,
        failure: null,
        noteRequest: { itemId: s.feedback.itemId, status: "asking" },
      };
    }
    case "note_received": {
      if (s.noteRequest?.status !== "asking") return s;
      const { note } = event;
      return {
        ...withCost(s, note.model, note.usage),
        failure: null,
        noteRequest: { ...s.noteRequest, status: "saving" },
        writes: [
          ...s.writes,
          { kind: "note", input: { ...note.note, sessionId: null } },
          { kind: "usage", usage: usageWrite(note.model, note.usage) },
        ],
        phase: "saving",
      };
    }
    case "note_failed": {
      if (s.noteRequest?.status !== "asking") return s;
      return withUsageWrite(
        { ...s, noteRequest: { ...s.noteRequest, status: "failed" } },
        event.failure,
        event.usage,
      );
    }
    case "note_opened":
      return { ...s, openNote: null };
    case "continue": {
      if (s.phase !== "feedback") return s;
      // INFO: a note being asked for or saved holds the sheet; a failed one is dropped with its failure.
      if (s.noteRequest !== null && s.noteRequest.status !== "failed") return s;
      const failure = s.noteRequest === null ? s.failure : null;
      return settle({
        ...s,
        feedback: null,
        picked: null,
        draft: "",
        noteRequest: null,
        failure,
      });
    }
    case "keep_going": {
      if (s.phase !== "result" || s.run === null || s.writes.length > 0) return s;
      if (practiceNext(s.items, s.run.target) !== "offer") return s;
      const target = keepGoingTarget(s.run.target);
      if (target !== 10 && target !== 15) return s;
      const first = s.run.target;
      return {
        ...s,
        run: { ...s.run, target },
        slots: [
          ...s.slots,
          ...planSlots({
            positions: Array.from({ length: target - first }, (_, index) => first + index),
            focus: s.focus,
            language: s.language,
            usedRules: s.items.map((entry) => entry.rule),
          }),
        ],
        writes: [{ kind: "target", target }],
        phase: "saving",
      };
    }
    case "finish_requested":
      if (s.phase !== "result" || s.run === null || s.run.finishedAt !== null) return s;
      return { ...s, writes: [{ kind: "finish" }], phase: "finishing" };
    case "left":
      return { ...s, stopped: true };
    case "retry": {
      if (s.failure === null) return s;
      if (s.noteRequest?.status === "failed" && s.failure.source === "ai") {
        return { ...s, failure: null, noteRequest: { ...s.noteRequest, status: "asking" } };
      }
      const base = { ...s, failure: null };
      if (base.writes.length > 0 || base.background.length > 0) return base;
      const item = currentItem(base);
      if (
        s.failure.source === "ai" &&
        s.phase === "answering" &&
        item !== null &&
        item.kind !== "choose" &&
        s.draft.trim() !== ""
      ) {
        return { ...base, phase: "grading" };
      }
      return settle(base);
    }
    case "context_refreshed":
    case "context_failed": {
      const next = withContext(s, event);
      const heldKey =
        event.type === "context_refreshed" &&
        s.held?.source === "ai" &&
        (s.held.failure === "invalid_key" || s.held.failure === "missing_key");
      return heldKey ? { ...next, held: null } : next;
    }
  }
}

export function practiceReducer(s: PracticeRunState, event: PracticeEvent): PracticeRunState {
  return schedule(reduce(s, event));
}

// INFO: what to do next, by priority: the writes the screen waits on, the background writes,
// the checks save, then (unless something stops the run or the learner left it) the AI calls the learner waits on
// (grade, note) and last the background stage of the slot.
export function practiceStep(s: PracticeRunState): PracticeStep {
  const [write] = s.writes;
  if (write !== undefined) return { kind: "write", write, lane: "screen" };
  const [queued] = s.background;
  if (queued !== undefined) return { kind: "write", write: queued, lane: "background" };
  if (s.checksDue && s.checks.length > 0) {
    return { kind: "checks", checks: s.checks.slice(0, MAX_CHECK_ROWS) };
  }
  if (s.stopped || s.failure !== null || sendState(s).locked || s.run === null) {
    return { kind: "none" };
  }
  if (s.noteRequest?.status === "asking") {
    const missed = s.items.find((entry) => entry.id === s.noteRequest?.itemId);
    if (missed !== undefined) return { kind: "note", request: studyNoteRequest(missed) };
  }
  const item = currentItem(s);
  if (s.phase === "grading" && item !== null) {
    return { kind: "grade", request: gradeRequest(item, s.draft.trim()) };
  }
  const work = s.work;
  if (work === null || s.held !== null) return { kind: "none" };
  if (s.phase === "result" || s.phase === "finishing") return { kind: "none" };
  if (work.stage === "write") {
    return {
      kind: "exercise",
      request: exerciseRequest({
        slot: work.slot,
        missedRules: missedRules(s.items),
        language: s.language,
        avoid: avoidFor(s),
      }),
    };
  }
  if (work.exercise === null) return { kind: "none" };
  if (work.stage === "solve") return { kind: "solve", request: solveRequest(work.exercise) };
  return { kind: "review", request: reviewRequest(work.exercise, work.solverAnswer ?? "") };
}

// INFO: after an AI failure the call or the answer is sent again; after a failed save the
// writes left resume without asking the tutor again.
export function practiceRetryKind(s: PracticeRunState): "resend" | "resume" {
  return s.failure?.source === "ai" ? "resend" : "resume";
}

// INFO: what the miss sheet's "Make me a study note" shows; null when the sheet has none: a right
// answer and a words run (notes are for grammar).
export function noteAction(s: PracticeRunState): { busy: boolean; disabled: boolean } | null {
  if (s.feedback === null || s.feedback.tone !== "miss" || s.focus.kind === "words") return null;
  const inFlight = s.noteRequest !== null && s.noteRequest.status !== "failed";
  return { busy: inFlight, disabled: sendState(s).locked };
}

// INFO: Continue is busy while the run saves and while the note is being asked for or saved.
export function continueBusy(s: PracticeRunState): boolean {
  const action = noteAction(s);
  return s.phase === "saving" || (action !== null && action.busy);
}

export function runTarget(s: PracticeRunState): number {
  if (s.run !== null) return s.run.target;
  return s.origin.kind === "new" ? s.origin.input.target : 5;
}

export function segments(s: PracticeRunState): SegmentState[] {
  const firstOpen = s.items.findIndex((item) => item.correct === null);
  return Array.from({ length: runTarget(s) }, (_, index) => {
    const item = s.items[index];
    if (item === undefined) return "pending";
    if (item.correct === true) return "done";
    if (item.correct === false) return "missed";
    return index === firstOpen ? "current" : "pending";
  });
}

// INFO: the segment that fills as the learner answers; null when no answer is on screen.
export function fillIndex(s: PracticeRunState): number | null {
  if (s.feedback === null) return null;
  const answered = s.feedback.itemId;
  const index = s.items.findIndex((item) => item.id === answered);
  return index === -1 ? null : index;
}

export function runOutcome(s: PracticeRunState): "offer" | "finished" {
  return s.run !== null && practiceNext(s.items, s.run.target) === "offer" ? "offer" : "finished";
}

export function exerciseView(item: PracticeItem): ExerciseView {
  const gap = item.kind === "choose" || item.kind === "gap" ? splitGap(item.prompt) : null;
  return {
    kindLabel: KIND_LABELS[item.kind],
    rule: item.rule,
    prompt: item.prompt,
    gap,
    card:
      item.kind === "fix"
        ? { label: item.source === null ? null : SOURCE_LABEL, text: item.prompt }
        : null,
    typed: item.kind !== "choose",
  };
}

// INFO: what fills the gap after an answer: a picked option, or a typed answer that was right.
export function gapFill(s: PracticeRunState): string | null {
  const item = currentItem(s);
  if (item === null || s.feedback === null) return null;
  if (item.kind === "choose") return s.picked;
  if (item.kind === "gap" && s.feedback.tone === "right") {
    return gapSentenceFill(item, item.userAnswer ?? "") ?? item.userAnswer;
  }
  return null;
}

// INFO: which body the run screen draws: the result, an exercise on screen, or the wait for the next exercise.
export function runBody(s: PracticeRunState): "result" | "exercise" | "generating" {
  if (s.phase === "result" || s.phase === "finishing") return "result";
  const exercising =
    s.phase === "answering" ||
    s.phase === "grading" ||
    s.phase === "feedback" ||
    s.phase === "saving";
  return exercising && currentItem(s) !== null ? "exercise" : "generating";
}

// INFO: the exercise number the progress shows, one based; with no exercise on screen it is the
// next one to come, never past the target.
export function progressPosition(s: PracticeRunState): number {
  const item = currentItem(s);
  if (item === null) return Math.min(s.items.length + 1, runTarget(s));
  return item.position + 1;
}

export type OptionState = "idle" | "right" | "wrong";

export function optionState(s: PracticeRunState, option: string): OptionState {
  if (s.feedback === null) return "idle";
  if (currentItem(s) === null || option !== s.picked) return "idle";
  return s.feedback.tone === "right" ? "right" : "wrong";
}
