// apps/mobile/test/utils/context-prompt.test.ts
//
// Tests for the request that summarizes the older turns of a chat.
//
// Tested:
// - the system asks for an English summary under SUMMARY_MAX that keeps what the tutor needs and adds nothing
// - the covered messages and the previous summary go as one learner turn of JSON
// - a learner reply carries its quoted text
// - the request never asks for or mentions an API key
//
// What is covered:
// - Normal case, empty case, edges
//
// Run with: pnpm exec jest apps/mobile/test/utils/context-prompt.test.ts
//
// SEE: apps/mobile/src/utils/context-prompt.ts

import { describe, expect, it } from "@jest/globals";

import type { ChatMessage } from "@/utils/chat-conversation";
import { SUMMARY_MAX } from "@/utils/chat-context";
import { CONTEXT_OUTPUT_GUIDE, RULE_CONTEXT_SUMMARY, summaryRequest } from "@/utils/context-prompt";
import { RULE_NO_KEY } from "@/utils/tutor-prompt";

function message(id: string, role: "user" | "tutor", text: string, replyTo: string | null = null) {
  const m: ChatMessage = {
    id,
    role,
    text,
    corrections: [],
    explanation: null,
    newWords: [],
    threadReplies: 0,
    replyTo,
    savedId: id,
    note: null,
  };
  return m;
}

const messages = [
  message("m0", "tutor", "Hi! What did you do today?"),
  message("m1", "user", "I went to the park."),
  message("m2", "tutor", "Nice!\nWas it sunny?"),
  message("m3", "user", "Yes", "m2"),
];

function payload(request: ReturnType<typeof summaryRequest>) {
  return JSON.parse(request.turns[0].text) as {
    previousSummary: string | null;
    messages: { role: string; text: string }[];
  };
}

describe("summaryRequest", () => {
  it("asks for an English summary under SUMMARY_MAX characters that keeps the learner, topics, mistakes, words and open question and adds nothing", () => {
    const { system } = summaryRequest(null, messages, messages);
    expect(system).toContain(RULE_CONTEXT_SUMMARY);
    expect(system).toContain(CONTEXT_OUTPUT_GUIDE);
    expect(RULE_CONTEXT_SUMMARY).toContain(String(SUMMARY_MAX));
    expect(RULE_CONTEXT_SUMMARY).toContain("English");
    for (const kept of ["about themselves", "topics", "mistakes", "words", "question"]) {
      expect(RULE_CONTEXT_SUMMARY).toContain(kept);
    }
    expect(RULE_CONTEXT_SUMMARY).toContain("Add nothing that was not said");
  });

  it("sends the previous summary and the covered messages as one learner turn of JSON", () => {
    const request = summaryRequest("Lives in Lisbon.", messages, messages.slice(0, 2));
    expect(request.turns).toHaveLength(1);
    expect(request.turns[0].role).toBe("user");
    expect(payload(request)).toEqual({
      previousSummary: "Lives in Lisbon.",
      messages: [
        { role: "tutor", text: "Hi! What did you do today?" },
        { role: "learner", text: "I went to the park." },
      ],
    });
  });

  it("sends null as the previous summary for a first summary", () => {
    expect(payload(summaryRequest(null, messages, messages)).previousSummary).toBeNull();
  });

  it("carries a learner reply's quoted text", () => {
    const sent = payload(summaryRequest(null, messages, messages)).messages;
    expect(sent[3]).toEqual({ role: "learner", text: "> Nice!\n> Was it sunny?\n\nYes" });
  });

  it("never asks for or mentions an API key", () => {
    const { system } = summaryRequest(null, messages, messages);
    expect(system).toContain(RULE_NO_KEY);
    expect(RULE_CONTEXT_SUMMARY.toLowerCase()).not.toContain("api key");
  });
});
