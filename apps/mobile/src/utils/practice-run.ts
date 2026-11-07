import {
  TUTOR_MODEL,
  usageCostUsd,
  type PracticeAnswer,
  type PracticeItem,
  type PracticeItemCreate,
  type PracticeRun,
  type PracticeRunCreate,
  type PracticeRunWithItems,
  type Profile,
  type Provider,
  type SessionUsage,
} from "@fluency-lab/shared";

import type { AnswerGrade, PracticeRound, TutorRequest } from "@/ai/ai-port";
import { round8, sendState, usageWrite, withContext } from "@/utils/chat-conversation";
import type { ContextEvent } from "@/utils/chat-conversation";
import type { ChatFailure } from "@/utils/chat-failure";
import { gradeChoice, localGrade } from "@/utils/practice-grade";
import { keepGoingTarget, missedRules, practiceNext, roundSize } from "@/utils/practice-escalation";
import type { PracticeOrigin } from "@/utils/practice-focus";
import { gradeRequest, roundRequest, type FocusData } from "@/utils/practice-prompt";
import { splitGap } from "@/utils/practice-round";

export type PracticeWrite =
  | { kind: "create"; input: PracticeRunCreate }
  | { kind: "items"; items: PracticeItemCreate[] }
  | { kind: "usage"; usage: SessionUsage }
  | { kind: "answer"; itemId: string; answer: PracticeAnswer }
  | { kind: "target"; target: 10 | 15 }
  | { kind: "finish" };

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

export type PracticeRunState = {
  origin: PracticeOrigin;
  run: PracticeRun | null;
  items: PracticeItem[];
  focus: FocusData;
  language: string | null;
  displayName: string | null;
  draft: string;
  picked: string | null;
  feedback: Feedback | null;
  phase: PracticePhase;
  writes: PracticeWrite[];
  failure: ChatFailure | null;
  provider: Provider | null;
  limitUsd: number | null;
  spentUsd: number;
};

export type PracticeEvent =
  | { type: "draft_changed"; text: string }
  | { type: "picked"; option: string }
  | { type: "check_started" }
  | { type: "round_received"; round: PracticeRound }
  // INFO: usage is present when the provider answered and billed a round that was not usable.
  | { type: "round_failed"; failure: ChatFailure; usage?: PracticeRound["usage"] }
  | { type: "grade_received"; grade: AnswerGrade }
  | { type: "grade_failed"; failure: ChatFailure; usage?: AnswerGrade["usage"] }
  // INFO: run follows a create, target or finish write; items follow an items write (every item of the run).
  | { type: "write_done"; run?: PracticeRun; items?: PracticeItem[] }
  | { type: "write_failed"; failure: ChatFailure }
  | { type: "continue" }
  | { type: "keep_going" }
  | { type: "finish_requested" }
  | { type: "retry" }
  | ContextEvent;

export type PracticeStep =
  | { kind: "none" }
  | { kind: "write"; write: PracticeWrite }
  | { kind: "round"; request: TutorRequest }
  | { kind: "grade"; request: TutorRequest };

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

const KIND_LABELS: Record<PracticeItem["kind"], string> = {
  choose: "Choose the answer",
  fix: "Fix the sentence",
  gap: "Fill the gap",
  translate: "Say it in English",
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
}): PracticeRunState {
  const { origin, opened, profile } = input;
  const base: PracticeRunState = {
    origin,
    run: opened?.run ?? null,
    items: opened?.items ?? [],
    focus: input.focus,
    language: input.language,
    displayName: profile.displayName,
    draft: "",
    picked: null,
    feedback: null,
    phase: "creating",
    writes:
      origin.kind === "new" && opened === null ? [{ kind: "create", input: origin.input }] : [],
    failure: null,
    provider: profile.provider,
    limitUsd: profile.monthlyLimitUsd,
    spentUsd: input.spentUsd,
  };
  return base.writes.length > 0 ? base : settle(base);
}

// INFO: where a run with no write pending goes next, from its items.
function settle(s: PracticeRunState): PracticeRunState {
  if (s.run === null) return { ...s, phase: "creating" };
  const next = practiceNext(s.items, s.run.target);
  if (next === "answer") return { ...s, phase: "answering" };
  if (next === "ask") return { ...s, phase: "asking" };
  if (next === "offer") return { ...s, phase: "result" };
  // INFO: with no offer the run ends as soon as the result shows.
  if (s.run.finishedAt === null) {
    return { ...s, writes: [...s.writes, { kind: "finish" }], phase: "finishing" };
  }
  return { ...s, phase: "result" };
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
  usage: PracticeRound["usage"],
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
  usage: PracticeRound["usage"] | undefined,
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
  if (event.items !== undefined && done.kind === "items") {
    next = { ...next, items: [...event.items].sort((a, b) => a.position - b.position) };
  }
  return writes.length === 0 ? afterWrites(next) : next;
}

export function practiceReducer(s: PracticeRunState, event: PracticeEvent): PracticeRunState {
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
      const grade = localGrade(item, text);
      if (grade === "ask") return { ...s, phase: "grading", failure: null };
      return answerItem(
        s,
        item,
        { correct: grade === "right", userAnswer: text, explanation: item.explanation },
        [],
      );
    }
    case "round_received": {
      if (s.phase !== "asking" || s.run === null) return s;
      const exercises = event.round.items.slice(0, roundSize(s.items, s.run.target));
      const items: PracticeItemCreate[] = exercises.map((exercise, index) => ({
        ...exercise,
        position: s.items.length + index,
      }));
      return {
        ...withCost(s, event.round.model, event.round.usage),
        failure: null,
        writes: [
          ...s.writes,
          { kind: "items", items },
          { kind: "usage", usage: usageWrite(event.round.model, event.round.usage) },
        ],
        phase: "saving",
      };
    }
    case "round_failed":
      return withUsageWrite(s, event.failure, event.usage);
    case "grade_received": {
      const item = currentItem(s);
      const text = s.draft.trim();
      if (s.phase !== "grading" || item === null) return s;
      const { grade } = event;
      const explanation = grade.explanation ?? item.explanation;
      const answered = answerItem(
        s,
        item,
        { correct: grade.correct, userAnswer: text, explanation },
        [{ kind: "usage", usage: usageWrite(grade.model, grade.usage) }],
      );
      return { ...withCost(answered, grade.model, grade.usage), draft: "" };
    }
    case "grade_failed":
      return withUsageWrite({ ...s, phase: "answering" }, event.failure, event.usage);
    case "write_done":
      return applyWrite(s, event);
    case "write_failed":
      return { ...s, failure: event.failure };
    case "continue":
      if (s.phase !== "feedback") return s;
      return settle({ ...s, feedback: null, picked: null, draft: "" });
    case "keep_going": {
      if (s.phase !== "result" || s.run === null || s.writes.length > 0) return s;
      if (practiceNext(s.items, s.run.target) !== "offer") return s;
      const target = keepGoingTarget(s.run.target);
      if (target !== 10 && target !== 15) return s;
      return {
        ...s,
        run: { ...s.run, target },
        writes: [{ kind: "target", target }],
        phase: "saving",
      };
    }
    case "finish_requested":
      if (s.phase !== "result" || s.run === null || s.run.finishedAt !== null) return s;
      return { ...s, writes: [{ kind: "finish" }], phase: "finishing" };
    case "retry": {
      if (s.failure === null) return s;
      const base = { ...s, failure: null };
      if (base.writes.length > 0) return base;
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
    case "context_failed":
      return withContext(s, event);
  }
}

export function practiceStep(s: PracticeRunState): PracticeStep {
  const [write] = s.writes;
  if (write !== undefined) return { kind: "write", write };
  if (s.failure !== null || sendState(s).locked || s.run === null) return { kind: "none" };
  if (s.phase === "asking") {
    return {
      kind: "round",
      request: roundRequest({
        focus: s.focus,
        count: roundSize(s.items, s.run.target),
        missedRules: missedRules(s.items),
        language: s.language,
      }),
    };
  }
  const item = currentItem(s);
  if (s.phase === "grading" && item !== null) {
    return { kind: "grade", request: gradeRequest(item, s.draft.trim()) };
  }
  return { kind: "none" };
}

// INFO: after an AI failure the round or the answer is sent again; after a failed save the
// writes left resume without asking the tutor again.
export function practiceRetryKind(s: PracticeRunState): "resend" | "resume" {
  return s.failure?.source === "ai" ? "resend" : "resume";
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
  if (item.kind === "gap" && s.feedback.tone === "right") return item.userAnswer;
  return null;
}

// INFO: which body the run screen draws: the result, an exercise on screen, or the wait for a round.
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
