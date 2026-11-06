// Test helper (not a test file): a fake of the AI port, so no test reaches a
// provider. Wire it with jest.mock("@/ai", () => ({ ai: fake.fakeAi })), where
// fake is jest.requireActual of this file. Call resetFakeAi() in beforeEach: it
// makes reply answer with tutorReplyWith({}), a normal reply, and replyInThread
// with threadReplyWith({}), a normal thread reply.

import { jest } from "@jest/globals";
import { TUTOR_MODEL } from "@fluency-lab/shared";

import type { AiPort, ThreadReply, TutorReply } from "@/ai/ai-port";

export const fakeAi = {
  reply: jest.fn<AiPort["reply"]>(),
  replyInThread: jest.fn<AiPort["replyInThread"]>(),
} satisfies AiPort;

export function tutorReplyWith(overrides: Partial<TutorReply> = {}): TutorReply {
  return {
    reply: "Nice! Where did you go?",
    corrections: [],
    explanation: null,
    newWords: [],
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

export function resetFakeAi(): void {
  fakeAi.reply.mockReset();
  fakeAi.reply.mockResolvedValue({ ok: true, value: tutorReplyWith() });
  fakeAi.replyInThread.mockReset();
  fakeAi.replyInThread.mockResolvedValue({ ok: true, value: threadReplyWith() });
}
