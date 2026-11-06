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
  messageCorrectionsSchema,
  messageCreateSchema,
  messageSchema,
  monthSpendSchema,
  openSessionsResponseSchema,
  newWordsSchema,
  profileSchema,
  profileStatsSchema,
  profileUpdateSchema,
  sessionCreateSchema,
  sessionIdParamSchema,
  sessionMessagesResponseSchema,
  sessionSummarySchema,
  sessionUsageSchema,
  sessionWeekSchema,
  tutorReplySchema,
  weekQuerySchema,
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
    const body = { session, messages: [] };
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
    const body = { session, messages: [saved] };
    expect(sessionMessagesResponseSchema.parse(body)).toEqual(body);
    expect(messageSchema.safeParse({ ...message, corrections: "x" }).success).toBe(false);
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
