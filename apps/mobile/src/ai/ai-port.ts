import type { Correction, ModelId, TokenUsage } from "@fluency-lab/shared";

import type { FailureCause } from "@/auth/auth-port";

export type TutorTurn = { role: "user" | "tutor"; text: string };

export type TutorRequest = { system: string; turns: TutorTurn[] };

export type TutorReply = {
  reply: string;
  corrections: Correction[];
  explanation: string | null;
  newWords: string[];
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

// INFO: a reply with no corrections and no new words is the expected empty, a success.
export type AiPort = {
  reply(request: TutorRequest): Promise<AiOutcome>;
  // INFO: a thread reply with no new words and no withdrawals is the expected empty, a success.
  replyInThread(request: TutorRequest): Promise<ThreadAiOutcome>;
};
