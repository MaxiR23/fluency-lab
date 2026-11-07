import type {
  Correction,
  ModelId,
  PracticeItemCreate,
  StudyNoteDraft,
  TokenUsage,
} from "@fluency-lab/shared";

import type { FailureCause } from "@/auth/auth-port";

export type TutorTurn = { role: "user" | "tutor"; text: string };

export type TutorRequest = { system: string; turns: TutorTurn[] };

export type TutorReply = {
  reply: string;
  corrections: Correction[];
  explanation: string | null;
  newWords: string[];
  // INFO: null when the tutor made no note, which is the usual case.
  note: StudyNoteDraft | null;
  model: ModelId;
  usage: TokenUsage;
};

// INFO: withdrawn holds the numbers (from 1) of the corrections the tutor takes back, as it read them.
export type ThreadReply = {
  reply: string;
  newWords: string[];
  withdrawn: number[];
  model: ModelId;
  usage: TokenUsage;
};

// INFO: one exercise of a round, as it is saved: the position is set when it is saved.
export type PracticeExercise = Omit<PracticeItemCreate, "position">;

export type PracticeRound = {
  items: PracticeExercise[];
  model: ModelId;
  usage: TokenUsage;
};

export type StudyNoteReply = { note: StudyNoteDraft; model: ModelId; usage: TokenUsage };

// INFO: explanation is null when the tutor gave none.
export type AnswerGrade = {
  correct: boolean;
  explanation: string | null;
  model: ModelId;
  usage: TokenUsage;
};

export type AiFailure =
  | "invalid_key"
  | "missing_key"
  | "key_unreadable"
  | "rate_limited"
  | "overloaded"
  | "network"
  | "refused"
  | "rejected"
  | "unavailable"
  | "bad_response";

// INFO: usage on a failure is present only when the provider answered 2xx and reported valid
// usage: that call was billed, so its cost still counts.
export type AiOutcome =
  | { ok: true; value: TutorReply }
  | { ok: false; failure: AiFailure; cause?: FailureCause; usage?: TokenUsage };

export type ThreadAiOutcome =
  | { ok: true; value: ThreadReply }
  | { ok: false; failure: AiFailure; cause?: FailureCause; usage?: TokenUsage };

// INFO: the outcome of the practice calls, as AiOutcome but for any value.
export type AiResult<T> =
  | { ok: true; value: T }
  | { ok: false; failure: AiFailure; cause?: FailureCause; usage?: TokenUsage };

// INFO: a reply with no corrections and no new words is the expected empty, a success.
export type AiPort = {
  reply(request: TutorRequest): Promise<AiOutcome>;
  // INFO: a thread reply with no new words and no withdrawals is the expected empty, a success.
  replyInThread(request: TutorRequest): Promise<ThreadAiOutcome>;
  // INFO: no expected empty for a round: a round with no usable exercise is a bad_response.
  practiceRound(request: TutorRequest): Promise<AiResult<PracticeRound>>;
  // INFO: an answer with no explanation is the expected empty: explanation is null.
  gradeAnswer(request: TutorRequest): Promise<AiResult<AnswerGrade>>;
  // INFO: no expected empty: a note that cannot be used is a bad_response.
  studyNote(request: TutorRequest): Promise<AiResult<StudyNoteReply>>;
};
