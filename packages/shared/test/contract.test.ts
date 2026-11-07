// packages/shared/test/contract.test.ts
//
// Tests for the request and response schemas of the API.
//
// Tested:
// - profileUpdateSchema, sessionCreateSchema and sessionIdParamSchema
// - The chat schemas: corrections, new words, the message to save, the usage and the tutor reply
// - The response schemas of the profile, the active session and the messages
// - The correction rule: optional, 1 to 80 characters, absent on old corrections
// - The session summary response
// - The open sessions response
// - The session week response and its query
// - The profile stats response and the account deleted response
// - The progress responses and their page queries
// - The practice schemas: the run to create, the items, the answer, the new target, the reads and the tutor payloads
// - The study note schemas: both shapes, their limits, the create body, the stored note, the page and the loose payload
// - The thread schemas: the stored correction with its withdrawn flag, the thread rows, the withdraw body, the reply counts and the thread reply payload
//
// What is covered:
// - Normal case, empty case, edges
//
// Run with: pnpm exec vitest run packages/shared/test/contract.test.ts
//
// SEE: packages/shared/src/contract.ts

import { describe, expect, it } from "vitest";
import {
  accountDeletedSchema,
  activeSessionResponseSchema,
  correctionSchema,
  correctionThreadSchema,
  historyPageSchema,
  mistakePageSchema,
  mistakesQuerySchema,
  messageCorrectionsSchema,
  messageCreateSchema,
  messageIdParamSchema,
  messageSchema,
  notePageSchema,
  studyNoteCreateSchema,
  studyNoteSchema,
  monthProgressSchema,
  monthSpendSchema,
  openSessionsResponseSchema,
  answerGradeSchema,
  practiceAnswerSchema,
  practiceItemCreateSchema,
  practiceItemSchema,
  practiceItemsCreateSchema,
  practiceRoundSchema,
  practiceRunCreateSchema,
  practiceRunSchema,
  practiceRunWithItemsSchema,
  practiceTargetSchema,
  practiceTodaySchema,
  newWordsSchema,
  profileSchema,
  profileStatsSchema,
  profileUpdateSchema,
  progressPageQuerySchema,
  sessionCreateSchema,
  sessionIdParamSchema,
  sessionMessagesResponseSchema,
  sessionSummarySchema,
  sessionUsageSchema,
  sessionWeekSchema,
  storedCorrectionSchema,
  threadMessageCreateSchema,
  threadMessageSchema,
  threadReplySchema,
  threadRepliesSchema,
  tutorReplySchema,
  weekQuerySchema,
  withdrawSchema,
  wordPageSchema,
} from "../src/contract";
import { TUTOR_MODEL } from "../src/model-price";
import { STARTERS } from "../src/suggestions";
import { sessionTitle } from "../src/session-title";
import { TOPIC_IDS } from "../src/topics";

const uuid = "6f1c2a4e-8d3b-4c5a-9e7f-1a2b3c4d5e6f";
const stamp = "2026-01-01 10:00:00+00";

const profile = {
  id: uuid,
  displayName: "Ada",
  level: "beginner",
  goals: ["work"],
  topics: ["food"],
  provider: "claude",
  monthlyLimitUsd: 10,
  onboardingCompletedAt: stamp,
  createdAt: stamp,
  updatedAt: stamp,
};

const session = {
  id: uuid,
  topicId: null,
  title: "Free chat",
  status: "active",
  summary: null,
  costUsd: 0,
  createdAt: stamp,
  updatedAt: stamp,
};

const message = {
  id: uuid,
  sessionId: uuid,
  role: "user",
  text: "Hello",
  corrections: null,
  newWords: null,
  replyToId: null,
  noteId: null,
  createdAt: stamp,
};

function accepts(value: unknown) {
  return profileUpdateSchema.safeParse(value).success;
}

describe("profileUpdateSchema", () => {
  it("accepts a full onboarding update", () => {
    expect(
      accepts({
        displayName: "Ada",
        level: "intermediate",
        goals: ["work", "travel"],
        topics: ["food", "music"],
        provider: "openai",
        monthlyLimitUsd: 25,
        onboardingCompleted: true,
      }),
    ).toBe(true);
  });

  it("accepts a single field", () => {
    expect(accepts({ level: "advanced" })).toBe(true);
  });

  it("rejects an empty object", () => {
    expect(accepts({})).toBe(false);
  });

  it("rejects an unknown level", () => {
    expect(accepts({ level: "expert" })).toBe(false);
  });

  it("rejects a goal outside the list", () => {
    expect(accepts({ goals: ["fame"] })).toBe(false);
  });

  it("rejects a repeated goal", () => {
    expect(accepts({ goals: ["work", "work"] })).toBe(false);
  });

  it("accepts an empty goal list", () => {
    expect(accepts({ goals: [] })).toBe(true);
  });

  it("rejects a topic outside the catalog", () => {
    expect(accepts({ topics: ["cooking"] })).toBe(false);
  });

  it("rejects a repeated topic", () => {
    expect(accepts({ topics: ["food", "food"] })).toBe(false);
  });

  it("accepts all twelve topics", () => {
    expect(accepts({ topics: [...TOPIC_IDS] })).toBe(true);
  });

  it("trims the display name", () => {
    const result = profileUpdateSchema.safeParse({ displayName: "  Ada  " });
    expect(result.success && result.data.displayName).toBe("Ada");
  });

  it("rejects a blank display name", () => {
    expect(accepts({ displayName: "   " })).toBe(false);
  });

  it("accepts 80 characters and rejects 81", () => {
    expect(accepts({ displayName: "a".repeat(80) })).toBe(true);
    expect(accepts({ displayName: "a".repeat(81) })).toBe(false);
  });

  it("accepts a null display name", () => {
    expect(accepts({ displayName: null })).toBe(true);
  });

  it("rejects a zero monthly limit", () => {
    expect(accepts({ monthlyLimitUsd: 0 })).toBe(false);
  });

  it("accepts 0.01 and 10000, rejects 10000.01", () => {
    expect(accepts({ monthlyLimitUsd: 0.01 })).toBe(true);
    expect(accepts({ monthlyLimitUsd: 10000 })).toBe(true);
    expect(accepts({ monthlyLimitUsd: 10000.01 })).toBe(false);
  });

  it("rejects a monthly limit under a cent or with more than 2 decimals", () => {
    expect(accepts({ monthlyLimitUsd: 0.004 })).toBe(false);
    expect(accepts({ monthlyLimitUsd: 12.345 })).toBe(false);
  });

  it("accepts monthly limits with at most 2 decimals", () => {
    for (const value of [0.01, 12.34, 0.07, 10000]) {
      expect(accepts({ monthlyLimitUsd: value })).toBe(true);
    }
  });

  it("rejects onboardingCompleted false", () => {
    expect(accepts({ onboardingCompleted: false })).toBe(false);
  });

  it("rejects an apiKey field", () => {
    expect(accepts({ level: "beginner", apiKey: "x" })).toBe(false);
  });
});

describe("sessionCreateSchema", () => {
  it("accepts a catalog topic", () => {
    expect(sessionCreateSchema.safeParse({ topicId: "music" }).success).toBe(true);
  });

  it("accepts null for a free chat", () => {
    expect(sessionCreateSchema.safeParse({ topicId: null }).success).toBe(true);
  });

  it("rejects a missing topicId", () => {
    expect(sessionCreateSchema.safeParse({}).success).toBe(false);
  });

  it("rejects a topic outside the catalog", () => {
    expect(sessionCreateSchema.safeParse({ topicId: "cooking" }).success).toBe(false);
  });

  it("rejects extra keys", () => {
    expect(sessionCreateSchema.safeParse({ topicId: null, status: "ended" }).success).toBe(false);
  });
});

describe("sessionIdParamSchema", () => {
  it("accepts a uuid", () => {
    expect(sessionIdParamSchema.safeParse({ id: uuid }).success).toBe(true);
  });

  it("rejects a non-uuid id", () => {
    expect(sessionIdParamSchema.safeParse({ id: "abc" }).success).toBe(false);
  });
});

describe("response schemas", () => {
  it("parses a profile body", () => {
    expect(profileSchema.parse(profile)).toEqual(profile);
  });

  it("rejects a profile body with a missing field", () => {
    const rest: Record<string, unknown> = { ...profile };
    delete rest.level;
    expect(profileSchema.safeParse(rest).success).toBe(false);
  });

  it("parses an empty active session body", () => {
    expect(activeSessionResponseSchema.parse({ activeSession: null })).toEqual({
      activeSession: null,
    });
  });

  it("parses an active session body with its last message", () => {
    const body = { activeSession: { session, lastMessage: message } };
    expect(activeSessionResponseSchema.parse(body)).toEqual(body);
  });

  it("parses a list of open sessions with and without a last message", () => {
    const body = {
      sessions: [
        { session, lastMessage: message },
        { session, lastMessage: null },
      ],
    };
    expect(openSessionsResponseSchema.parse(body)).toEqual(body);
  });

  it("parses an empty list of open sessions", () => {
    expect(openSessionsResponseSchema.parse({ sessions: [] })).toEqual({ sessions: [] });
  });

  it("rejects a missing sessions field and an item with a bad session", () => {
    expect(openSessionsResponseSchema.safeParse({}).success).toBe(false);
    expect(
      openSessionsResponseSchema.safeParse({
        sessions: [{ session: { id: "x" }, lastMessage: null }],
      }).success,
    ).toBe(false);
  });

  it("parses a session body with no messages", () => {
    const body = { session, messages: [], threadReplies: [], notes: [] };
    expect(sessionMessagesResponseSchema.parse(body)).toEqual(body);
  });

  it("parses a session body with saved corrections and new words", () => {
    const saved = {
      ...message,
      corrections: {
        items: [{ original: "I never been", corrected: "I've never been" }],
        explanation: "Use the present perfect.",
      },
      newWords: ["definitely"],
    };
    const body = { session, messages: [saved], threadReplies: [], notes: [] };
    expect(sessionMessagesResponseSchema.parse(body)).toEqual(body);
    expect(messageSchema.safeParse({ ...message, corrections: "x" }).success).toBe(false);
  });

  it("parses a message with a null replyToId and one with a replyToId", () => {
    expect(messageSchema.parse({ ...message, replyToId: null }).replyToId).toBeNull();
    expect(messageSchema.parse({ ...message, replyToId: "t1" }).replyToId).toBe("t1");
  });

  it("parses a month spend of zero and rejects a negative one", () => {
    const body = { monthStart: "2026-11-01", spentUsd: 0 };
    expect(monthSpendSchema.parse(body)).toEqual(body);
    expect(monthSpendSchema.safeParse({ ...body, spentUsd: -1 }).success).toBe(false);
    expect(monthSpendSchema.safeParse({ ...body, monthStart: "2026-11" }).success).toBe(false);
  });

  it("parses a session week with no days", () => {
    const body = { weekStart: "2026-11-02", today: "2026-11-05", days: [] };
    expect(sessionWeekSchema.parse(body)).toEqual(body);
  });

  it("parses a session week with days", () => {
    const body = { weekStart: "2026-11-02", today: "2026-11-05", days: ["2026-11-02"] };
    expect(sessionWeekSchema.parse(body)).toEqual(body);
  });

  it("rejects a session week with a malformed date, a missing today or days that are not a list", () => {
    const ok = { weekStart: "2026-11-02", today: "2026-11-05", days: [] };
    expect(sessionWeekSchema.safeParse({ ...ok, weekStart: "2026-11-2" }).success).toBe(false);
    expect(sessionWeekSchema.safeParse({ weekStart: ok.weekStart, days: [] }).success).toBe(false);
    expect(sessionWeekSchema.safeParse({ ...ok, days: "2026-11-02" }).success).toBe(false);
  });
});

describe("weekQuerySchema", () => {
  it("accepts a time zone", () => {
    expect(weekQuerySchema.parse({ tz: "UTC" })).toEqual({ tz: "UTC" });
  });

  it("rejects a missing or empty time zone", () => {
    expect(weekQuerySchema.safeParse({}).success).toBe(false);
    expect(weekQuerySchema.safeParse({ tz: "" }).success).toBe(false);
  });
});

describe("sessionCreateSchema with a starter", () => {
  it("accepts a starter id", () => {
    expect(sessionCreateSchema.safeParse({ starterId: "tech-app" }).success).toBe(true);
  });

  it("rejects an unknown starter, both fields together and an empty body", () => {
    expect(sessionCreateSchema.safeParse({ starterId: "nope" }).success).toBe(false);
    expect(sessionCreateSchema.safeParse({ topicId: null, starterId: "tech-app" }).success).toBe(
      false,
    );
    expect(sessionCreateSchema.safeParse({}).success).toBe(false);
  });

  it("no starter is titled like a free chat", () => {
    for (const entry of STARTERS) expect(entry.title).not.toBe(sessionTitle(null));
  });
});

describe("correction schemas", () => {
  const item = { original: "I never been", corrected: "I've never been" };

  it("accepts a correction and rejects an empty or extra field", () => {
    expect(correctionSchema.safeParse(item).success).toBe(true);
    expect(correctionSchema.safeParse({ ...item, original: " " }).success).toBe(false);
    expect(correctionSchema.safeParse({ ...item, apiKey: "x" }).success).toBe(false);
  });

  it("accepts a correction with a rule and one without (saved before rules)", () => {
    const withRule = { ...item, rule: "Present perfect for experiences" };
    expect(correctionSchema.parse(withRule)).toEqual(withRule);
    expect(correctionSchema.parse(item)).toEqual(item);
  });

  it("rejects an empty rule and accepts a rule of 80 characters but not 81", () => {
    expect(correctionSchema.safeParse({ ...item, rule: " " }).success).toBe(false);
    expect(correctionSchema.safeParse({ ...item, rule: "a".repeat(80) }).success).toBe(true);
    expect(correctionSchema.safeParse({ ...item, rule: "a".repeat(81) }).success).toBe(false);
  });

  it("accepts a message's corrections where only some items carry a rule", () => {
    const body = { items: [{ ...item, rule: "Articles" }, item], explanation: null };
    expect(messageCorrectionsSchema.safeParse(body).success).toBe(true);
  });

  it("accepts a side of 300 characters and rejects 301", () => {
    expect(correctionSchema.safeParse({ ...item, corrected: "a".repeat(300) }).success).toBe(true);
    expect(correctionSchema.safeParse({ ...item, corrected: "a".repeat(301) }).success).toBe(false);
  });

  it("accepts no corrections and a null explanation (the empty case)", () => {
    expect(messageCorrectionsSchema.safeParse({ items: [], explanation: null }).success).toBe(true);
  });

  it("accepts 10 corrections and rejects 11", () => {
    const items = (n: number) => Array.from({ length: n }, () => item);
    expect(
      messageCorrectionsSchema.safeParse({ items: items(10), explanation: null }).success,
    ).toBe(true);
    expect(
      messageCorrectionsSchema.safeParse({ items: items(11), explanation: null }).success,
    ).toBe(false);
  });

  it("limits the explanation to 300 characters", () => {
    const body = { items: [item], explanation: "a".repeat(300) };
    expect(messageCorrectionsSchema.safeParse(body).success).toBe(true);
    expect(
      messageCorrectionsSchema.safeParse({ ...body, explanation: "a".repeat(301) }).success,
    ).toBe(false);
  });

  it("accepts no new words, 10 words of 60 characters, and rejects 11 or 61", () => {
    expect(newWordsSchema.safeParse([]).success).toBe(true);
    expect(newWordsSchema.safeParse(Array.from({ length: 10 }, () => "a".repeat(60))).success).toBe(
      true,
    );
    expect(newWordsSchema.safeParse(Array.from({ length: 11 }, () => "a")).success).toBe(false);
    expect(newWordsSchema.safeParse(["a".repeat(61)]).success).toBe(false);
    expect(newWordsSchema.safeParse([" "]).success).toBe(false);
  });
});

describe("messageCreateSchema", () => {
  it("accepts a plain message and one with corrections and new words", () => {
    expect(messageCreateSchema.safeParse({ role: "tutor", text: "Hi" }).success).toBe(true);
    expect(
      messageCreateSchema.safeParse({
        role: "user",
        text: "Hi",
        corrections: { items: [], explanation: null },
        newWords: ["word"],
      }).success,
    ).toBe(true);
  });

  it("accepts a message with a uuid replyToId and one without", () => {
    const replyToId = crypto.randomUUID();
    expect(messageCreateSchema.safeParse({ role: "user", text: "Hi", replyToId }).success).toBe(
      true,
    );
    expect(messageCreateSchema.safeParse({ role: "user", text: "Hi" }).success).toBe(true);
  });

  it("rejects a replyToId that is not a uuid and a null one", () => {
    expect(
      messageCreateSchema.safeParse({ role: "user", text: "Hi", replyToId: "abc" }).success,
    ).toBe(false);
    expect(
      messageCreateSchema.safeParse({ role: "user", text: "Hi", replyToId: null }).success,
    ).toBe(false);
  });

  it("limits the text to 4000 characters and rejects empty text", () => {
    expect(messageCreateSchema.safeParse({ role: "user", text: "a".repeat(4000) }).success).toBe(
      true,
    );
    expect(messageCreateSchema.safeParse({ role: "user", text: "a".repeat(4001) }).success).toBe(
      false,
    );
    expect(messageCreateSchema.safeParse({ role: "user", text: "  " }).success).toBe(false);
  });

  it("rejects an extra apiKey field and an unknown role", () => {
    expect(messageCreateSchema.safeParse({ role: "user", text: "Hi", apiKey: "x" }).success).toBe(
      false,
    );
    expect(messageCreateSchema.safeParse({ role: "system", text: "Hi" }).success).toBe(false);
  });
});

describe("sessionUsageSchema", () => {
  const usage = {
    model: TUTOR_MODEL,
    inputTokens: 700,
    outputTokens: 150,
    cacheCreationInputTokens: 0,
    cacheReadInputTokens: 0,
  };

  it("accepts a usage and a zero usage", () => {
    expect(sessionUsageSchema.safeParse(usage).success).toBe(true);
    expect(
      sessionUsageSchema.safeParse({ ...usage, inputTokens: 0, outputTokens: 0 }).success,
    ).toBe(true);
  });

  it("rejects an unknown model, a negative count, a fraction and an extra field", () => {
    expect(sessionUsageSchema.safeParse({ ...usage, model: "other" }).success).toBe(false);
    expect(sessionUsageSchema.safeParse({ ...usage, inputTokens: -1 }).success).toBe(false);
    expect(sessionUsageSchema.safeParse({ ...usage, outputTokens: 1.5 }).success).toBe(false);
    expect(sessionUsageSchema.safeParse({ ...usage, inputTokens: 10_000_001 }).success).toBe(false);
    expect(sessionUsageSchema.safeParse({ ...usage, apiKey: "x" }).success).toBe(false);
  });
});

describe("tutorReplySchema", () => {
  it("parses a reply and one with nothing to correct", () => {
    const full = {
      reply: "Nice!",
      corrections: [{ original: "a", corrected: "b" }],
      explanation: "Because.",
      newWords: ["definitely"],
    };
    expect(tutorReplySchema.parse(full)).toEqual(full);
    const empty = { reply: "Nice!", corrections: [], explanation: "", newWords: [] };
    expect(tutorReplySchema.parse(empty)).toEqual(empty);
  });

  it("parses a tutor correction with a rule", () => {
    const body = {
      reply: "Nice!",
      corrections: [{ original: "a", corrected: "b", rule: "Articles" }],
      explanation: "Because.",
      newWords: [],
    };
    expect(tutorReplySchema.parse(body)).toEqual(body);
  });

  it("parses a tutor correction without a rule", () => {
    const body = {
      reply: "Nice!",
      corrections: [{ original: "a", corrected: "b" }],
      explanation: "",
      newWords: [],
    };
    expect(tutorReplySchema.parse(body)).toEqual(body);
  });

  it("rejects a missing field and a wrong type", () => {
    expect(tutorReplySchema.safeParse({ reply: "x", corrections: [], newWords: [] }).success).toBe(
      false,
    );
    expect(
      tutorReplySchema.safeParse({ reply: 1, corrections: [], explanation: "", newWords: [] })
        .success,
    ).toBe(false);
  });
});

describe("sessionSummarySchema", () => {
  const body = {
    session,
    messageCount: 4,
    corrections: [{ original: "a", corrected: "b", rule: "Articles" }],
    newWords: ["definitely"],
  };

  it("parses a session with its count, corrections and words", () => {
    expect(sessionSummarySchema.parse(body)).toEqual(body);
  });

  it("parses an empty summary: zero messages, no corrections, no words", () => {
    const empty = { session, messageCount: 0, corrections: [], newWords: [] };
    expect(sessionSummarySchema.parse(empty)).toEqual(empty);
  });

  it("rejects a negative or fractional message count", () => {
    expect(sessionSummarySchema.safeParse({ ...body, messageCount: -1 }).success).toBe(false);
    expect(sessionSummarySchema.safeParse({ ...body, messageCount: 1.5 }).success).toBe(false);
  });

  it("parses an old correction without a rule inside a summary", () => {
    const old = { ...body, corrections: [{ original: "a", corrected: "b" }] };
    expect(sessionSummarySchema.parse(old)).toEqual(old);
  });
});

describe("profileStatsSchema", () => {
  it("accepts whole counts of zero or more", () => {
    expect(profileStatsSchema.safeParse({ sessions: 12, dayStreak: 3, newWords: 48 }).success).toBe(
      true,
    );
    expect(profileStatsSchema.safeParse({ sessions: 0, dayStreak: 0, newWords: 0 }).success).toBe(
      true,
    );
  });

  it("rejects a negative or fractional count and a missing field", () => {
    expect(profileStatsSchema.safeParse({ sessions: -1, dayStreak: 0, newWords: 0 }).success).toBe(
      false,
    );
    expect(profileStatsSchema.safeParse({ sessions: 1, dayStreak: 1.5, newWords: 0 }).success).toBe(
      false,
    );
    expect(profileStatsSchema.safeParse({ sessions: 1, dayStreak: 1 }).success).toBe(false);
  });
});

describe("accountDeletedSchema", () => {
  it("accepts { deleted: true } and rejects anything else", () => {
    expect(accountDeletedSchema.safeParse({ deleted: true }).success).toBe(true);
    expect(accountDeletedSchema.safeParse({ deleted: false }).success).toBe(false);
    expect(accountDeletedSchema.safeParse({}).success).toBe(false);
    expect(accountDeletedSchema.safeParse({ deleted: "true" }).success).toBe(false);
  });
});

describe("progressPageQuerySchema and mistakesQuerySchema", () => {
  it("reads the zone and an offset as a number", () => {
    expect(progressPageQuerySchema.parse({ tz: "UTC", offset: "20" })).toEqual({
      tz: "UTC",
      offset: 20,
    });
    expect(mistakesQuerySchema.parse({ offset: "20" })).toEqual({ offset: 20 });
  });

  it("leaves the offset out when it is absent", () => {
    expect(progressPageQuerySchema.parse({ tz: "UTC" })).toEqual({ tz: "UTC" });
    expect(mistakesQuerySchema.parse({})).toEqual({});
  });

  it("accepts offset 0 and 999999", () => {
    expect(progressPageQuerySchema.parse({ tz: "UTC", offset: "0" }).offset).toBe(0);
    expect(progressPageQuerySchema.parse({ tz: "UTC", offset: "999999" }).offset).toBe(999999);
    expect(mistakesQuerySchema.parse({ offset: "0" }).offset).toBe(0);
    expect(mistakesQuerySchema.parse({ offset: "999999" }).offset).toBe(999999);
  });

  it("rejects a negative, a decimal, a leading zero, a non-number and an offset over 999999", () => {
    for (const offset of ["-1", "1.5", "01", "abc", "1000000"]) {
      expect(progressPageQuerySchema.safeParse({ tz: "UTC", offset }).success).toBe(false);
      expect(mistakesQuerySchema.safeParse({ offset }).success).toBe(false);
    }
  });

  it("rejects an empty zone", () => {
    expect(progressPageQuerySchema.safeParse({ tz: "" }).success).toBe(false);
  });
});

describe("monthProgressSchema", () => {
  const body = { monthStart: "2026-11-01", sessions: 12, corrections: 31, newWords: 48 };

  it("parses the month and its three counts", () => {
    expect(monthProgressSchema.parse(body)).toEqual(body);
  });

  it("parses zeros", () => {
    const zeros = { monthStart: "2026-11-01", sessions: 0, corrections: 0, newWords: 0 };
    expect(monthProgressSchema.parse(zeros)).toEqual(zeros);
  });

  it("rejects a negative count", () => {
    expect(monthProgressSchema.safeParse({ ...body, corrections: -1 }).success).toBe(false);
  });
});

describe("historyPageSchema", () => {
  const item = { session, day: "2026-11-05", messageCount: 14, correctionCount: 3 };

  it("parses ended sessions with their day and counts and the next offset", () => {
    const body = { items: [item], nextOffset: 20 };
    expect(historyPageSchema.parse(body)).toEqual(body);
  });

  it("parses an empty page with no next offset", () => {
    const body = { items: [], nextOffset: null };
    expect(historyPageSchema.parse(body)).toEqual(body);
  });

  it("rejects a day that is not a date", () => {
    const body = { items: [{ ...item, day: "Nov 5" }], nextOffset: null };
    expect(historyPageSchema.safeParse(body).success).toBe(false);
  });
});

describe("mistakePageSchema", () => {
  it("parses a group with a rule and one without (null)", () => {
    const body = {
      items: [
        { rule: "Present perfect", times: 5, latest: { original: "I goed", corrected: "I went" } },
        { rule: null, times: 1, latest: { original: "a", corrected: "b" } },
      ],
      nextOffset: null,
    };
    expect(mistakePageSchema.parse(body)).toEqual(body);
  });

  it("rejects times of 0", () => {
    const body = {
      items: [{ rule: null, times: 0, latest: { original: "a", corrected: "b" } }],
      nextOffset: null,
    };
    expect(mistakePageSchema.safeParse(body).success).toBe(false);
  });
});

describe("wordPageSchema", () => {
  it("parses words with their sentence and day", () => {
    const body = {
      items: [{ word: "catchy", sentence: "That song is catchy.", day: "2026-11-05" }],
      nextOffset: 20,
    };
    expect(wordPageSchema.parse(body)).toEqual(body);
  });

  it("parses an empty page", () => {
    const body = { items: [], nextOffset: null };
    expect(wordPageSchema.parse(body)).toEqual(body);
  });
});

describe("storedCorrectionSchema", () => {
  const item = { original: "the next year", corrected: "next year" };

  it("accepts an item with withdrawn true and one without it", () => {
    expect(storedCorrectionSchema.safeParse({ ...item, withdrawn: true }).success).toBe(true);
    expect(storedCorrectionSchema.safeParse(item).success).toBe(true);
  });

  it("rejects withdrawn false and an unknown key", () => {
    expect(storedCorrectionSchema.safeParse({ ...item, withdrawn: false }).success).toBe(false);
    expect(storedCorrectionSchema.safeParse({ ...item, apiKey: "x" }).success).toBe(false);
  });

  it("lets a message be read with a withdrawn correction", () => {
    const withdrawn = {
      ...message,
      corrections: { items: [{ ...item, withdrawn: true }], explanation: null },
    };
    expect(messageSchema.parse(withdrawn)).toEqual(withdrawn);
  });

  it("does not let a client create a message with a withdrawn correction", () => {
    const created = {
      role: "user",
      text: "Hello",
      corrections: { items: [{ ...item, withdrawn: true }], explanation: null },
    };
    expect(messageCreateSchema.safeParse(created).success).toBe(false);
  });
});

describe("thread schemas", () => {
  it("accepts a user and a tutor row with and without new words", () => {
    expect(threadMessageCreateSchema.safeParse({ role: "user", text: "Why?" }).success).toBe(true);
    expect(
      threadMessageCreateSchema.safeParse({ role: "tutor", text: "Because", newWords: ["a"] })
        .success,
    ).toBe(true);
  });

  it("rejects empty text, 4001 characters, 11 words and an unknown key", () => {
    expect(threadMessageCreateSchema.safeParse({ role: "user", text: " " }).success).toBe(false);
    expect(
      threadMessageCreateSchema.safeParse({ role: "user", text: "a".repeat(4001) }).success,
    ).toBe(false);
    expect(
      threadMessageCreateSchema.safeParse({
        role: "user",
        text: "x",
        newWords: Array.from({ length: 11 }, (_, i) => `w${i}`),
      }).success,
    ).toBe(false);
    expect(threadMessageCreateSchema.safeParse({ role: "user", text: "x", extra: 1 }).success).toBe(
      false,
    );
  });

  it("accepts the indexes to withdraw", () => {
    expect(withdrawSchema.safeParse({ items: [0] }).success).toBe(true);
    expect(withdrawSchema.safeParse({ items: [0, 9] }).success).toBe(true);
  });

  it("rejects empty, out of range, negative, fractional, repeated and 11 indexes", () => {
    for (const items of [[], [10], [-1], [1.5], [1, 1], Array.from({ length: 11 }, (_, i) => i)]) {
      expect(withdrawSchema.safeParse({ items }).success).toBe(false);
    }
  });

  it("accepts a uuid as the message id and rejects anything else", () => {
    expect(messageIdParamSchema.safeParse({ id: uuid }).success).toBe(true);
    expect(messageIdParamSchema.safeParse({ id: "x" }).success).toBe(false);
  });

  it("parses a thread row and a thread with and without messages", () => {
    const row = {
      id: uuid,
      messageId: uuid,
      role: "user",
      text: "Why?",
      newWords: null,
      createdAt: stamp,
    };
    expect(threadMessageSchema.parse(row)).toEqual(row);
    const full = { session, message, messages: [row] };
    expect(correctionThreadSchema.parse(full)).toEqual(full);
    const empty = { session, message, messages: [] };
    expect(correctionThreadSchema.parse(empty)).toEqual(empty);
  });

  it("requires the reply counts and accepts none", () => {
    const body = {
      session,
      messages: [],
      threadReplies: [{ messageId: uuid, count: 2 }],
      notes: [],
    };
    expect(sessionMessagesResponseSchema.parse(body)).toEqual(body);
    expect(
      sessionMessagesResponseSchema.parse({ ...body, threadReplies: [], notes: [] }).threadReplies,
    ).toEqual([]);
    expect(sessionMessagesResponseSchema.safeParse({ session, messages: [] }).success).toBe(false);
    expect(threadRepliesSchema.safeParse([{ messageId: uuid, count: 0 }]).success).toBe(false);
  });

  it("parses the thread reply payload and rejects a missing withdrawn", () => {
    const payload = { reply: "Yes", newWords: [], withdrawn: [1] };
    expect(threadReplySchema.parse(payload)).toEqual(payload);
    expect(threadReplySchema.safeParse({ reply: "Yes", newWords: [] }).success).toBe(false);
  });
});

describe("practice schemas", () => {
  const item = {
    position: 0,
    kind: "choose",
    rule: "Present perfect",
    prompt: "I ___ there twice.",
    options: ["have been", "was", "am"],
    accepted: ["have been"],
    explanation: "Use the present perfect for experience.",
    source: null,
  };
  const run = {
    id: uuid,
    focus: "topic",
    topicId: "conditionals",
    target: 5,
    costUsd: 0.01,
    createdAt: "2026-11-07T10:00:00.000Z",
    finishedAt: null,
    noteId: null,
  };
  const stored = {
    id: uuid,
    runId: uuid,
    ...item,
    userAnswer: null,
    correct: null,
    answeredAt: null,
  };

  it("accepts a topic run with a grammar topic", () => {
    expect(
      practiceRunCreateSchema.safeParse({ focus: "topic", topicId: "articles", target: 10 })
        .success,
    ).toBe(true);
    expect(practiceRunCreateSchema.safeParse({ focus: "mistakes", target: 5 }).success).toBe(true);
    expect(practiceRunCreateSchema.safeParse({ focus: "words", target: 15 }).success).toBe(true);
  });

  it("rejects a topic run without a topic and a mistakes run with a topic", () => {
    expect(practiceRunCreateSchema.safeParse({ focus: "topic", target: 5 }).success).toBe(false);
    expect(
      practiceRunCreateSchema.safeParse({ focus: "mistakes", topicId: "articles", target: 5 })
        .success,
    ).toBe(false);
    expect(
      practiceRunCreateSchema.safeParse({ focus: "topic", topicId: "sports", target: 5 }).success,
    ).toBe(false);
  });

  it("rejects a target of 7", () => {
    expect(practiceRunCreateSchema.safeParse({ focus: "mistakes", target: 7 }).success).toBe(false);
  });

  it("accepts a choose item with three options and its answer among them", () => {
    expect(practiceItemCreateSchema.parse(item)).toEqual(item);
  });

  it("rejects a choose item with two options and with an answer outside its options", () => {
    expect(
      practiceItemCreateSchema.safeParse({ ...item, options: ["have been", "was"] }).success,
    ).toBe(false);
    expect(practiceItemCreateSchema.safeParse({ ...item, accepted: ["were"] }).success).toBe(false);
    expect(
      practiceItemCreateSchema.safeParse({ ...item, accepted: ["have been", "was"] }).success,
    ).toBe(false);
  });

  it("rejects options on a fix item and a choose item without options", () => {
    expect(practiceItemCreateSchema.safeParse({ ...item, kind: "fix" }).success).toBe(false);
    expect(practiceItemCreateSchema.safeParse({ ...item, options: null }).success).toBe(false);
    expect(
      practiceItemCreateSchema.safeParse({
        ...item,
        kind: "fix",
        options: null,
        prompt: "I has a car.",
        accepted: ["I have a car."],
        source: "I has a car.",
      }).success,
    ).toBe(true);
  });

  it("rejects an item with no accepted answer", () => {
    expect(practiceItemCreateSchema.safeParse({ ...item, accepted: [] }).success).toBe(false);
  });

  it("rejects a rule of 81 characters and accepts 80", () => {
    expect(practiceItemCreateSchema.safeParse({ ...item, rule: "r".repeat(80) }).success).toBe(
      true,
    );
    expect(practiceItemCreateSchema.safeParse({ ...item, rule: "r".repeat(81) }).success).toBe(
      false,
    );
  });

  it("rejects six items and accepts five", () => {
    const items = (count: number) =>
      Array.from({ length: count }, (_, position) => ({ ...item, position }));
    expect(practiceItemsCreateSchema.safeParse({ items: items(5) }).success).toBe(true);
    expect(practiceItemsCreateSchema.safeParse({ items: items(6) }).success).toBe(false);
    expect(practiceItemsCreateSchema.safeParse({ items: [] }).success).toBe(false);
  });

  it("rejects two items with the same position", () => {
    expect(practiceItemsCreateSchema.safeParse({ items: [item, item] }).success).toBe(false);
  });

  it("parses an answer and rejects an empty one", () => {
    expect(practiceAnswerSchema.parse({ userAnswer: " have been ", correct: true })).toEqual({
      userAnswer: "have been",
      correct: true,
    });
    expect(practiceAnswerSchema.safeParse({ userAnswer: " ", correct: true }).success).toBe(false);
  });

  it("accepts only 10 and 15 as a new target", () => {
    expect(practiceTargetSchema.safeParse({ target: 10 }).success).toBe(true);
    expect(practiceTargetSchema.safeParse({ target: 15 }).success).toBe(true);
    expect(practiceTargetSchema.safeParse({ target: 5 }).success).toBe(false);
    expect(practiceTargetSchema.safeParse({ target: 20 }).success).toBe(false);
  });

  it("parses a run with no items", () => {
    expect(practiceRunSchema.parse(run)).toEqual(run);
    expect(practiceRunWithItemsSchema.parse({ run, items: [] })).toEqual({ run, items: [] });
  });

  it("parses a stored item", () => {
    expect(practiceItemSchema.parse(stored)).toEqual(stored);
  });

  it("parses today with no run", () => {
    expect(practiceTodaySchema.parse({ run: null })).toEqual({ run: null });
    expect(practiceTodaySchema.parse({ run: { run, items: [stored] } }).run?.items).toHaveLength(1);
  });

  it("parses the loose tutor payloads", () => {
    const round = {
      items: [
        {
          kind: "gap",
          rule: "r",
          prompt: "p",
          options: [],
          accepted: ["a"],
          explanation: "e",
          source: "",
        },
      ],
    };
    expect(practiceRoundSchema.parse(round)).toEqual(round);
    expect(practiceRoundSchema.safeParse({ items: [{ kind: "gap" }] }).success).toBe(false);
    expect(answerGradeSchema.parse({ correct: false, explanation: "" })).toEqual({
      correct: false,
      explanation: "",
    });
  });
});

describe("study notes", () => {
  const table = {
    kind: "table",
    title: "Future forms",
    topic: "Going to, will",
    sessionId: null,
    content: {
      columns: ["Form", "When", "Example"],
      rows: [["going to", "plans", "I'm going to study."]],
      remember: "Plans use going to.",
    },
  };
  const summary = {
    kind: "summary",
    title: "Present perfect",
    topic: "Have + past participle",
    sessionId: uuid,
    content: { points: ["Use it for experience."], remember: "Think of now." },
  };
  const tableOf = (content: object) => ({ ...table, content: { ...table.content, ...content } });
  const rowOf = (n: number) => Array.from({ length: n }, (_, i) => `c${i}`);

  it("accepts a table note with three columns and rows of three cells", () => {
    expect(studyNoteCreateSchema.safeParse(table).success).toBe(true);
  });

  it("accepts a summary note with points", () => {
    expect(studyNoteCreateSchema.safeParse(summary).success).toBe(true);
  });

  it("rejects a table with two or four columns", () => {
    expect(studyNoteCreateSchema.safeParse(tableOf({ columns: ["a", "b"] })).success).toBe(false);
    expect(studyNoteCreateSchema.safeParse(tableOf({ columns: rowOf(4) })).success).toBe(false);
  });

  it("rejects a table row with two or four cells", () => {
    expect(studyNoteCreateSchema.safeParse(tableOf({ rows: [rowOf(2)] })).success).toBe(false);
    expect(studyNoteCreateSchema.safeParse(tableOf({ rows: [rowOf(4)] })).success).toBe(false);
  });

  it("rejects a table with no rows and one with nine", () => {
    const rows = (n: number) => Array.from({ length: n }, () => rowOf(3));
    expect(studyNoteCreateSchema.safeParse(tableOf({ rows: rows(0) })).success).toBe(false);
    expect(studyNoteCreateSchema.safeParse(tableOf({ rows: rows(9) })).success).toBe(false);
    expect(studyNoteCreateSchema.safeParse(tableOf({ rows: rows(1) })).success).toBe(true);
    expect(studyNoteCreateSchema.safeParse(tableOf({ rows: rows(8) })).success).toBe(true);
  });

  it("rejects a summary with no points and one with nine", () => {
    const points = (n: number) => rowOf(n);
    const withPoints = (n: number) => ({
      ...summary,
      content: { ...summary.content, points: points(n) },
    });
    expect(studyNoteCreateSchema.safeParse(withPoints(0)).success).toBe(false);
    expect(studyNoteCreateSchema.safeParse(withPoints(9)).success).toBe(false);
    expect(studyNoteCreateSchema.safeParse(withPoints(8)).success).toBe(true);
  });

  it("rejects a note whose content does not match its kind", () => {
    expect(studyNoteCreateSchema.safeParse({ ...summary, kind: "table" }).success).toBe(false);
  });

  it("rejects an empty remember line and a title over 80 characters", () => {
    expect(studyNoteCreateSchema.safeParse(tableOf({ remember: " " })).success).toBe(false);
    expect(studyNoteCreateSchema.safeParse({ ...table, title: "a".repeat(81) }).success).toBe(
      false,
    );
    expect(studyNoteCreateSchema.safeParse({ ...table, title: "a".repeat(80) }).success).toBe(true);
  });

  it("rejects an unknown key in the content", () => {
    expect(studyNoteCreateSchema.safeParse(tableOf({ extra: 1 })).success).toBe(false);
  });

  it("accepts a note create with a session id or with null", () => {
    expect(studyNoteCreateSchema.safeParse({ ...table, sessionId: uuid }).success).toBe(true);
    expect(studyNoteCreateSchema.safeParse({ ...table, sessionId: null }).success).toBe(true);
    expect(studyNoteCreateSchema.safeParse({ ...table, sessionId: "x" }).success).toBe(false);
  });

  it("reads a stored note with its session title or none", () => {
    const stored = {
      ...table,
      id: uuid,
      sessionTitle: "Free chat",
      createdAt: stamp,
    };
    expect(studyNoteSchema.parse(stored).sessionTitle).toBe("Free chat");
    expect(studyNoteSchema.parse({ ...stored, sessionTitle: null }).sessionTitle).toBeNull();
  });

  it("parses a notes page with today", () => {
    const item = { id: uuid, kind: "table", title: "t", topic: "p", day: "2026-11-07" };
    const page = { items: [item], nextOffset: 20, today: "2026-11-07" };
    expect(notePageSchema.parse(page)).toEqual(page);
    const empty = { items: [], nextOffset: null, today: "2026-11-07" };
    expect(notePageSchema.parse(empty)).toEqual(empty);
  });

  it("accepts a message create with a note id", () => {
    expect(messageCreateSchema.safeParse({ role: "tutor", text: "Hi", noteId: uuid }).success).toBe(
      true,
    );
    expect(messageCreateSchema.safeParse({ role: "tutor", text: "Hi", noteId: "x" }).success).toBe(
      false,
    );
  });

  it("accepts a note practice run and rejects one without its note", () => {
    expect(
      practiceRunCreateSchema.safeParse({ focus: "note", noteId: uuid, target: 5 }).success,
    ).toBe(true);
    expect(practiceRunCreateSchema.safeParse({ focus: "note", target: 5 }).success).toBe(false);
  });

  it("parses a tutor reply with and without a note", () => {
    const base = { reply: "r", corrections: [], explanation: "", newWords: [] };
    const note = {
      kind: "table",
      title: "t",
      topic: "p",
      columns: [],
      rows: [],
      points: [],
      remember: "r",
    };
    expect(tutorReplySchema.parse({ ...base, note }).note).toEqual(note);
    expect(tutorReplySchema.parse(base).note).toBeUndefined();
  });

  it("reads a message and a practice run with a null note id", () => {
    expect(messageSchema.parse(message).noteId).toBeNull();
    expect(messageSchema.parse({ ...message, noteId: uuid }).noteId).toBe(uuid);
  });
});
