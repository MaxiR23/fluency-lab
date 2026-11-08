// Test helper (not a test file): a fake of the AI port, so no test reaches a
// provider. Wire it with jest.mock("@/ai", () => ({ ai: fake.fakeAi })), where
// fake is jest.requireActual of this file. Call resetFakeAi() in beforeEach: it
// makes reply answer with tutorReplyWith({}), a normal reply, and replyInThread
// with threadReplyWith({}), a normal thread reply, practiceRound with five choose exercises and
// gradeAnswer with a wrong verdict and an explanation, studyNote with a table note, and summarize
// with contextSummaryWith({}), a short summary.

import { jest } from "@jest/globals";
import { TUTOR_MODEL, type StudyNoteDraft } from "@fluency-lab/shared";

import type {
  AiPort,
  AnswerGrade,
  ContextSummaryReply,
  PracticeExercise,
  PracticeRound,
  StudyNoteReply,
  ThreadReply,
  TutorReply,
} from "@/ai/ai-port";

export const fakeAi = {
  reply: jest.fn<AiPort["reply"]>(),
  replyInThread: jest.fn<AiPort["replyInThread"]>(),
  practiceRound: jest.fn<AiPort["practiceRound"]>(),
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

// INFO: five choose exercises by default.
export function practiceRoundWith(overrides: Partial<PracticeRound> = {}): PracticeRound {
  return {
    items: Array.from({ length: 5 }, (_, index) =>
      exerciseWith({ prompt: `I ___ to Japan ${index + 1} times.` }),
    ),
    model: TUTOR_MODEL,
    usage,
    ...overrides,
  };
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
  fakeAi.practiceRound.mockReset();
  fakeAi.practiceRound.mockResolvedValue({ ok: true, value: practiceRoundWith() });
  fakeAi.gradeAnswer.mockReset();
  fakeAi.gradeAnswer.mockResolvedValue({ ok: true, value: answerGradeWith() });
  fakeAi.studyNote.mockReset();
  fakeAi.studyNote.mockResolvedValue({ ok: true, value: studyNoteReplyWith() });
  fakeAi.summarize.mockReset();
  fakeAi.summarize.mockResolvedValue({ ok: true, value: contextSummaryWith() });
}
