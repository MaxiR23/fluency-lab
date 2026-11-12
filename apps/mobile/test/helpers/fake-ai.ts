// Test helper (not a test file): a fake of the AI port, so no test reaches a
// provider. Wire it with jest.mock("@/ai", () => ({ ai: fake.fakeAi })), where
// fake is jest.requireActual of this file. Call resetFakeAi() in beforeEach: it
// makes reply answer with tutorReplyWith({}), a normal reply, and replyInThread
// with threadReplyWith({}), a normal thread reply, practiceExercise with an exercise of the kind in
// its request that passes the code check (a new prompt each call), solveExercise with the first
// accepted answer of the exercise whose prompt it was given, reviewExercise with every check true,
// gradeAnswer with a wrong verdict and an explanation, studyNote with a table note, and summarize
// with contextSummaryWith({}), a short summary.

import { jest } from "@jest/globals";
import {
  PRACTICE_KINDS,
  TUTOR_MODEL,
  type PracticeExercisePayload,
  type PracticeKind,
  type StudyNoteDraft,
} from "@fluency-lab/shared";

import type {
  AiPort,
  AnswerGrade,
  ContextSummaryReply,
  ExerciseReview,
  ExerciseSolution,
  PracticeExercise,
  PracticeExerciseDraft,
  StudyNoteReply,
  ThreadReply,
  TutorReply,
} from "@/ai/ai-port";

export const fakeAi = {
  reply: jest.fn<AiPort["reply"]>(),
  replyInThread: jest.fn<AiPort["replyInThread"]>(),
  practiceExercise: jest.fn<AiPort["practiceExercise"]>(),
  solveExercise: jest.fn<AiPort["solveExercise"]>(),
  reviewExercise: jest.fn<AiPort["reviewExercise"]>(),
  gradeAnswer: jest.fn<AiPort["gradeAnswer"]>(),
  studyNote: jest.fn<AiPort["studyNote"]>(),
  summarize: jest.fn<AiPort["summarize"]>(),
} satisfies AiPort;

export function tutorReplyWith(overrides: Partial<TutorReply> = {}): TutorReply {
  return {
    reply: "Nice! Where did you go?",
    corrections: [],
    explanation: null,
    newWords: [],
    note: null,
    title: null,
    model: TUTOR_MODEL,
    usage: {
      inputTokens: 700,
      outputTokens: 150,
      cacheCreationInputTokens: 0,
      cacheReadInputTokens: 0,
    },
    ...overrides,
  };
}

export function threadReplyWith(overrides: Partial<ThreadReply> = {}): ThreadReply {
  return {
    reply: "The article is not needed with next year.",
    newWords: [],
    withdrawn: [],
    model: TUTOR_MODEL,
    usage: {
      inputTokens: 500,
      outputTokens: 80,
      cacheCreationInputTokens: 0,
      cacheReadInputTokens: 0,
    },
    ...overrides,
  };
}

const usage = {
  inputTokens: 600,
  outputTokens: 400,
  cacheCreationInputTokens: 0,
  cacheReadInputTokens: 0,
};

// INFO: a choose exercise: "I ___ to Japan twice." with three options and one right.
export function exerciseWith(overrides: Partial<PracticeExercise> = {}): PracticeExercise {
  return {
    kind: "choose",
    rule: "Present perfect",
    prompt: "I ___ to Japan twice.",
    options: ["have been", "was", "am"],
    accepted: ["have been"],
    explanation: "Use the present perfect for an experience.",
    source: null,
    ...overrides,
  };
}

// INFO: an exercise of the kind that passes the code check; n keeps the prompts apart.
export function exerciseFor(kind: PracticeKind, n: number): PracticeExerciseDraft["exercise"] {
  const base = { rule: "Rule", explanation: "Because of the rule.", options: [], source: "" };
  if (kind === "choose") {
    return {
      ...base,
      kind,
      rule: "Present perfect",
      prompt: `I ___ to Japan ${n} times.`,
      options: ["have been", "was", "am"],
      accepted: ["have been"],
    };
  }
  if (kind === "gap") {
    return {
      ...base,
      kind,
      rule: "Past simple",
      prompt: `I ___ (go) to Japan ${n} times.`,
      accepted: ["went"],
    };
  }
  if (kind === "fix") {
    return {
      ...base,
      kind,
      rule: "Third person s",
      prompt: `She go to work ${n} days a week.`,
      accepted: [`She goes to work ${n} days a week.`],
      source: `She go to work ${n} days a week.`,
    };
  }
  return {
    ...base,
    kind,
    rule: "Past simple",
    prompt: `Fui a Japón ${n} veces.`,
    accepted: [`I went to Japan ${n} times.`],
  };
}

const usageOf = (inputTokens: number, outputTokens: number) => ({
  inputTokens,
  outputTokens,
  cacheCreationInputTokens: 0,
  cacheReadInputTokens: 0,
});

export function exerciseDraftWith(
  overrides: Partial<PracticeExerciseDraft> = {},
): PracticeExerciseDraft {
  return {
    exercise: exerciseFor("choose", 1),
    model: TUTOR_MODEL,
    usage: usageOf(400, 150),
    ...overrides,
  };
}

export function solutionWith(overrides: Partial<ExerciseSolution> = {}): ExerciseSolution {
  return {
    answer: "have been",
    alreadyCorrect: false,
    model: TUTOR_MODEL,
    usage: usageOf(150, 20),
    ...overrides,
  };
}

// INFO: every check true, so the exercise passes.
export function reviewWith(overrides: Partial<ExerciseReview> = {}): ExerciseReview {
  return {
    singleAnswer: true,
    meaningKept: true,
    answerNotInPrompt: true,
    oneRealMistake: true,
    naturalEnglish: true,
    solverAnswerAccepted: true,
    passed: true,
    reason: null,
    model: TUTOR_MODEL,
    usage: usageOf(250, 40),
    ...overrides,
  };
}

function userTurn(request: { turns: readonly { text: string }[] }): Record<string, unknown> {
  const text = request.turns[request.turns.length - 1]?.text ?? "{}";
  const parsed: unknown = JSON.parse(text);
  return typeof parsed === "object" && parsed !== null ? (parsed as Record<string, unknown>) : {};
}

// INFO: a table note on going to and will, as the tutor would make it.
export function noteWith(overrides: Partial<StudyNoteDraft> = {}): StudyNoteDraft {
  return {
    kind: "table",
    title: "Future forms",
    topic: "Going to, will",
    content: {
      columns: ["Form", "When", "Example"],
      rows: [
        ["going to", "plans already made", "I'm going to study tonight."],
        ["will", "decisions made now", "I'll help you with that."],
      ],
      remember: "Plans use going to; instant decisions use will.",
    },
    ...overrides,
  } as StudyNoteDraft;
}

export function studyNoteReplyWith(overrides: Partial<StudyNoteReply> = {}): StudyNoteReply {
  return {
    note: noteWith(),
    model: TUTOR_MODEL,
    usage: { ...usage, inputTokens: 300, outputTokens: 350 },
    ...overrides,
  };
}

export function answerGradeWith(overrides: Partial<AnswerGrade> = {}): AnswerGrade {
  return {
    flawed: false,
    correct: false,
    explanation: "Use the present perfect for an experience.",
    model: TUTOR_MODEL,
    usage: { ...usage, inputTokens: 200, outputTokens: 60 },
    ...overrides,
  };
}

export function contextSummaryWith(
  overrides: Partial<ContextSummaryReply> = {},
): ContextSummaryReply {
  return {
    summary: "The learner lives in Lisbon and works in tech.",
    model: TUTOR_MODEL,
    usage: { ...usage, inputTokens: 900, outputTokens: 120 },
    ...overrides,
  };
}

export function resetFakeAi(): void {
  fakeAi.reply.mockReset();
  fakeAi.reply.mockResolvedValue({ ok: true, value: tutorReplyWith() });
  fakeAi.replyInThread.mockReset();
  fakeAi.replyInThread.mockResolvedValue({ ok: true, value: threadReplyWith() });
  let written = 0;
  const issued = new Map<string, PracticeExercisePayload>();
  fakeAi.practiceExercise.mockReset();
  fakeAi.practiceExercise.mockImplementation(async (request) => {
    const kind = PRACTICE_KINDS.find((entry) => entry === userTurn(request).kind) ?? "choose";
    written += 1;
    const exercise = exerciseFor(kind, written);
    issued.set(exercise.prompt, exercise);
    return { ok: true, value: exerciseDraftWith({ exercise }) };
  });
  fakeAi.solveExercise.mockReset();
  fakeAi.solveExercise.mockImplementation(async (request) => {
    const prompt = userTurn(request).prompt;
    const exercise = typeof prompt === "string" ? issued.get(prompt) : undefined;
    return { ok: true, value: solutionWith({ answer: exercise?.accepted[0] ?? "" }) };
  });
  fakeAi.reviewExercise.mockReset();
  fakeAi.reviewExercise.mockResolvedValue({ ok: true, value: reviewWith() });
  fakeAi.gradeAnswer.mockReset();
  fakeAi.gradeAnswer.mockResolvedValue({ ok: true, value: answerGradeWith() });
  fakeAi.studyNote.mockReset();
  fakeAi.studyNote.mockResolvedValue({ ok: true, value: studyNoteReplyWith() });
  fakeAi.summarize.mockReset();
  fakeAi.summarize.mockResolvedValue({ ok: true, value: contextSummaryWith() });
}
