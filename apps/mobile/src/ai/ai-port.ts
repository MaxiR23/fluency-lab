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

// INFO: a reply with no corrections and no new words is the expected empty, a success.
export type AiPort = {
  reply(request: TutorRequest): Promise<AiOutcome>;
};
