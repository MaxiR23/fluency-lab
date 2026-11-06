// packages/shared/test/contract.test.ts
//
// Tests for the request and response schemas of the API.
//
// Tested:
// - profileUpdateSchema, sessionCreateSchema and sessionIdParamSchema
// - The response schemas of the profile, the active session and the messages
//
// What is covered:
// - Normal case, empty case, edges
//
// Run with: pnpm exec vitest run packages/shared/test/contract.test.ts
//
// SEE: packages/shared/src/contract.ts

import { describe, expect, it } from "vitest";
import {
  activeSessionResponseSchema,
  messagesResponseSchema,
  profileSchema,
  profileUpdateSchema,
  sessionCreateSchema,
  sessionIdParamSchema,
} from "../src/contract";
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

  it("parses a messages body with no messages", () => {
    expect(messagesResponseSchema.parse({ messages: [] })).toEqual({ messages: [] });
  });
});
