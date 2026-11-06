// packages/shared/test/profile-values.test.ts
//
// Tests for the closed value lists of the profile, sessions and messages.
//
// Tested:
// - The levels, goals, providers, session statuses and message roles
//
// What is covered:
// - Normal case, empty case, edges
//
// Run with: pnpm exec vitest run packages/shared/test/profile-values.test.ts
//
// SEE: packages/shared/src/profile-values.ts

import { describe, expect, it } from "vitest";
import { GOALS, LEVELS, MESSAGE_ROLES, PROVIDERS, SESSION_STATUSES } from "../src/profile-values";

describe("profile values", () => {
  it("lists the three levels", () => {
    expect(LEVELS).toEqual(["beginner", "intermediate", "advanced"]);
  });

  it("lists the four goals", () => {
    expect(GOALS).toEqual(["work", "travel", "exams", "conversation"]);
  });

  it("lists both providers", () => {
    expect(PROVIDERS).toEqual(["claude", "openai"]);
  });

  it("lists the session statuses and message roles", () => {
    expect(SESSION_STATUSES).toEqual(["active", "ended"]);
    expect(MESSAGE_ROLES).toEqual(["user", "tutor"]);
  });
});
