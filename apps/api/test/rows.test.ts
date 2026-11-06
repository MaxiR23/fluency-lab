// apps/api/test/rows.test.ts
//
// Tests for the mapping of database rows to the API contract.
//
// Tested:
// - toProfile, toSession and toMessage rename snake_case rows and reject bad rows
// - toOpenSession reads a session row with its newest embedded message
// - toSessionStart reads the start time of a session row
// - toSessionCost reads the start time and the cost of a session row
// - toProfilePatch renames an update to columns
//
// What is covered:
// - Normal case, empty case, edges
//
// Run with: pnpm exec vitest run apps/api/test/rows.test.ts
//
// SEE: apps/api/src/rows.ts

import { describe, expect, it } from "vitest";
import {
  toMessage,
  toOpenSession,
  toProfile,
  toProfilePatch,
  toSession,
  toSessionCost,
  toSessionStart,
} from "../src/rows";

const id = "6f1c2a4e-8d3b-4c5a-9e7f-1a2b3c4d5e6f";
const stamp = "2026-01-01T10:00:00+00:00";

const profileRow = {
  id,
  display_name: "Ada",
  level: "beginner",
  goals: ["work"],
  topics: ["food"],
  monthly_limit_usd: 12.5,
  provider: "claude",
  onboarding_completed_at: stamp,
  created_at: stamp,
  updated_at: stamp,
};

const sessionRow = {
  id,
  user_id: id,
  topic_id: "music",
  title: "Music",
  status: "active",
  summary: null,
  cost_usd: 0.25,
  created_at: stamp,
  updated_at: stamp,
};

const messageRow = {
  id,
  session_id: id,
  role: "tutor",
  text: "Hi",
  corrections: { items: [{ original: "a", corrected: "b" }], explanation: "Because." },
  new_words: ["word"],
  created_at: stamp,
};

function without(row: Record<string, unknown>, key: string): Record<string, unknown> {
  const copy = { ...row };
  delete copy[key];
  return copy;
}

describe("toProfile", () => {
  it("maps a profile row to the contract", () => {
    expect(toProfile(profileRow)).toEqual({
      id,
      displayName: "Ada",
      level: "beginner",
      goals: ["work"],
      topics: ["food"],
      provider: "claude",
      monthlyLimitUsd: 12.5,
      onboardingCompletedAt: stamp,
      createdAt: stamp,
      updatedAt: stamp,
    });
  });

  it("maps a fresh profile with no onboarding data", () => {
    const fresh = {
      ...profileRow,
      display_name: null,
      level: null,
      goals: [],
      topics: [],
      monthly_limit_usd: null,
      provider: null,
      onboarding_completed_at: null,
    };
    expect(toProfile(fresh)).toMatchObject({
      displayName: null,
      level: null,
      goals: [],
      topics: [],
      monthlyLimitUsd: null,
      provider: null,
      onboardingCompletedAt: null,
    });
  });

  it("returns null for a row with a missing column", () => {
    expect(toProfile(without(profileRow, "goals"))).toBeNull();
  });

  it("returns null for a level outside the list", () => {
    expect(toProfile({ ...profileRow, level: "expert" })).toBeNull();
  });

  it("returns null for something that is not a row", () => {
    expect(toProfile(null)).toBeNull();
  });
});

describe("toSession", () => {
  it("maps a session row to the contract", () => {
    expect(toSession(sessionRow)).toEqual({
      id,
      topicId: "music",
      title: "Music",
      status: "active",
      summary: null,
      costUsd: 0.25,
      createdAt: stamp,
      updatedAt: stamp,
    });
  });

  it("maps a free chat session with a null topic", () => {
    expect(toSession({ ...sessionRow, topic_id: null })?.topicId).toBeNull();
  });

  it("returns null for a row with a missing column", () => {
    expect(toSession(without(sessionRow, "title"))).toBeNull();
  });

  it("returns null for a status outside the list", () => {
    expect(toSession({ ...sessionRow, status: "paused" })).toBeNull();
  });
});

describe("toMessage", () => {
  it("maps a message row to the contract", () => {
    expect(toMessage(messageRow)).toEqual({
      id,
      sessionId: id,
      role: "tutor",
      text: "Hi",
      corrections: { items: [{ original: "a", corrected: "b" }], explanation: "Because." },
      newWords: ["word"],
      createdAt: stamp,
    });
  });

  it("returns null for corrections that are not the saved shape", () => {
    expect(toMessage({ ...messageRow, corrections: "a" })).toBeNull();
    expect(toMessage({ ...messageRow, corrections: [{ from: "a", to: "b" }] })).toBeNull();
    expect(toMessage({ ...messageRow, new_words: "a" })).toBeNull();
  });

  it("keeps null corrections and new words", () => {
    const result = toMessage({ ...messageRow, corrections: null, new_words: null });
    expect(result?.corrections).toBeNull();
    expect(result?.newWords).toBeNull();
  });

  it("returns null for a row with a missing column", () => {
    expect(toMessage(without(messageRow, "text"))).toBeNull();
  });

  it("returns null for a role outside the list", () => {
    expect(toMessage({ ...messageRow, role: "system" })).toBeNull();
  });
});

describe("toProfilePatch", () => {
  const now = new Date("2026-02-03T04:05:06.000Z");

  it("renames every field to its column", () => {
    expect(
      toProfilePatch(
        {
          displayName: "Ada",
          level: "advanced",
          goals: ["work"],
          topics: ["food"],
          provider: "openai",
          monthlyLimitUsd: 5,
        },
        now,
      ),
    ).toEqual({
      display_name: "Ada",
      level: "advanced",
      goals: ["work"],
      topics: ["food"],
      provider: "openai",
      monthly_limit_usd: 5,
    });
  });

  it("sets onboarding_completed_at from the clock", () => {
    expect(toProfilePatch({ onboardingCompleted: true }, now)).toEqual({
      onboarding_completed_at: "2026-02-03T04:05:06.000Z",
    });
  });

  it("leaves out absent fields", () => {
    expect(toProfilePatch({ level: "beginner" }, now)).toEqual({ level: "beginner" });
  });

  it("keeps a null display name as null", () => {
    expect(toProfilePatch({ displayName: null }, now)).toEqual({ display_name: null });
  });
});

describe("toSessionStart", () => {
  it("returns the created_at of the row", () => {
    expect(toSessionStart({ created_at: stamp })).toBe(stamp);
  });

  it("returns null for a missing field", () => {
    expect(toSessionStart({})).toBeNull();
  });

  it("returns null for text that is not a timestamp", () => {
    expect(toSessionStart({ created_at: "yesterday" })).toBeNull();
  });

  it("returns null for a number", () => {
    expect(toSessionStart({ created_at: 1 })).toBeNull();
  });
});

describe("toSessionCost", () => {
  it("maps a cost row", () => {
    expect(toSessionCost({ created_at: stamp, cost_usd: 0.000145 })).toEqual({
      createdAt: stamp,
      costUsd: 0.000145,
    });
  });

  it("maps a zero cost", () => {
    expect(toSessionCost({ created_at: stamp, cost_usd: 0 })?.costUsd).toBe(0);
  });

  it("returns null for a row without a cost or with a bad date", () => {
    expect(toSessionCost({ created_at: stamp })).toBeNull();
    expect(toSessionCost({ created_at: "yesterday", cost_usd: 1 })).toBeNull();
  });
});

describe("toOpenSession", () => {
  it("maps a session row with its newest message", () => {
    expect(toOpenSession({ ...sessionRow, messages: [messageRow] })).toMatchObject({
      session: { id, title: "Music" },
      lastMessage: { text: "Hi", role: "tutor" },
    });
  });

  it("maps a session with no messages to a null last message", () => {
    expect(toOpenSession({ ...sessionRow, messages: [] })).toMatchObject({
      session: { id },
      lastMessage: null,
    });
  });

  it("returns null for a bad session row", () => {
    expect(toOpenSession({ id, messages: [] })).toBeNull();
  });

  it("returns null for a bad embedded message", () => {
    expect(toOpenSession({ ...sessionRow, messages: [{ id }] })).toBeNull();
  });

  it("returns null without a messages list", () => {
    expect(toOpenSession(sessionRow)).toBeNull();
  });
});
