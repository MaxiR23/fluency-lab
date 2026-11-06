// apps/mobile/test/utils/suggestion-list.test.ts
//
// Tests for the view of the "See all" suggestions list.
//
// Tested:
// - suggestionListView builds the list for the profile's level, or carries
//   the failure of the profile read
//
// What is covered:
// - Normal case, empty case, edges
//
// Run with: pnpm exec jest apps/mobile/test/utils/suggestion-list.test.ts
//
// SEE: apps/mobile/src/utils/suggestion-list.ts

import { describe, expect, it } from "@jest/globals";
import { allSuggestions } from "@fluency-lab/shared";

import { suggestionListView } from "@/utils/suggestion-list";
import { profileWith } from "../helpers/fake-data";

describe("suggestionListView", () => {
  it("lists every suggestion for the profile's level", () => {
    const profile = profileWith({ level: "beginner", topics: ["music"], goals: ["work"] });
    expect(suggestionListView({ ok: true, value: profile })).toEqual({
      kind: "ready",
      suggestions: allSuggestions(profile),
    });
  });

  it("is empty when no starter fits", () => {
    const profile = profileWith({ level: "beginner" });
    expect(suggestionListView({ ok: true, value: profile }, [])).toEqual({ kind: "empty" });
  });

  it("carries the failure of the profile read", () => {
    expect(suggestionListView({ ok: false, failure: "network" })).toEqual({
      kind: "failed",
      failure: "network",
    });
  });
});
