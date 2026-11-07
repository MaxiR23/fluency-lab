// packages/shared/test/profile-values.test.ts
//
// Tests for the closed value lists of the profile, sessions and messages.
//
// Tested:
// - The levels, goals, providers, session statuses and message roles
// - The goal labels
// - The practice focuses, kinds and targets
// - The note kinds
//
// What is covered:
// - Normal case, empty case, edges
//
// Run with: pnpm exec vitest run packages/shared/test/profile-values.test.ts
//
// SEE: packages/shared/src/profile-values.ts

import { describe, expect, it } from "vitest";
import {
  GOALS,
  GOAL_LABELS,
  LEVELS,
  MESSAGE_ROLES,
  NOTE_KINDS,
  PRACTICE_FOCUSES,
  PRACTICE_KINDS,
  PRACTICE_MAX_TARGET,
  PRACTICE_ROUND_SIZE,
  PRACTICE_TARGETS,
  PROVIDERS,
  SESSION_STATUSES,
  goalLabel,
} from "../src/profile-values";

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

  it("labels every goal", () => {
    expect(goalLabel("work")).toBe("Work");
    expect(goalLabel("travel")).toBe("Travel");
    expect(goalLabel("exams")).toBe("Exams");
    expect(goalLabel("conversation")).toBe("Everyday conversation");
  });

  it("has a label for each goal and no other", () => {
    expect(Object.keys(GOAL_LABELS)).toEqual([...GOALS]);
  });

  it("holds the four focuses, four kinds and the targets 5, 10 and 15", () => {
    expect(PRACTICE_FOCUSES).toEqual(["mistakes", "words", "topic", "note"]);
    expect(PRACTICE_KINDS).toEqual(["choose", "fix", "gap", "translate"]);
    expect(PRACTICE_TARGETS).toEqual([5, 10, 15]);
  });

  it("lists the two note kinds", () => {
    expect(NOTE_KINDS).toEqual(["table", "summary"]);
  });

  it("allows a note focus", () => {
    expect(PRACTICE_FOCUSES).toContain("note");
  });

  it("caps the target at 15 and rounds at 5", () => {
    expect(PRACTICE_MAX_TARGET).toBe(15);
    expect(PRACTICE_ROUND_SIZE).toBe(5);
    expect(PRACTICE_TARGETS.every((target) => target % PRACTICE_ROUND_SIZE === 0)).toBe(true);
    expect(Math.max(...PRACTICE_TARGETS)).toBe(PRACTICE_MAX_TARGET);
  });
});
