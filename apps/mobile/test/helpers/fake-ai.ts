// Test helper (not a test file): a fake of the AI port, so no test reaches a
// provider. Wire it with jest.mock("@/ai", () => ({ ai: fake.fakeAi })), where
// fake is jest.requireActual of this file. Call resetFakeAi() in beforeEach: it
// makes reply answer with tutorReplyWith({}), a normal reply.

import { jest } from "@jest/globals";
import { TUTOR_MODEL } from "@fluency-lab/shared";

import type { AiPort, TutorReply } from "@/ai/ai-port";

export const fakeAi = {
  reply: jest.fn<AiPort["reply"]>(),
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

export function resetFakeAi(): void {
  fakeAi.reply.mockReset();
  fakeAi.reply.mockResolvedValue({ ok: true, value: tutorReplyWith() });
}
