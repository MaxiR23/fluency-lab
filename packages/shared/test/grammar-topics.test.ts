// packages/shared/test/grammar-topics.test.ts
//
// Tests for the grammar topic catalog of the daily practice.
//
// Tested:
// - The eight topics in catalog order, with unique ids
// - Which topics each level suggests
// - The order that puts the suggested topics first
// - grammarTopicLabel returns the label of a topic id, and the raw id for one outside the catalog
//
// What is covered:
// - Normal case, empty case, edges
//
// Run with: pnpm exec vitest run packages/shared/test/grammar-topics.test.ts
//
// SEE: packages/shared/src/grammar-topics.ts

import { describe, expect, it } from "vitest";
import { LEVELS } from "../src/profile-values";
import {
  GRAMMAR_TOPICS,
  GRAMMAR_TOPIC_IDS,
  grammarTopicLabel,
  orderedGrammarTopics,
  suggestedGrammarTopics,
} from "../src/grammar-topics";

describe("GRAMMAR_TOPICS", () => {
  it("lists the eight topics in catalog order with unique ids", () => {
    expect(GRAMMAR_TOPIC_IDS).toEqual([
      "going_to_vs_will",
      "present_simple_future",
      "past_simple_vs_present_perfect",
      "present_perfect",
      "conditionals",
      "prepositions_of_time",
      "articles",
      "phrasal_verbs",
    ]);
    expect(new Set(GRAMMAR_TOPIC_IDS).size).toBe(GRAMMAR_TOPICS.length);
  });

  it("gives every level at least one suggestion", () => {
    for (const level of LEVELS) {
      expect(suggestedGrammarTopics(level).length).toBeGreaterThan(0);
    }
  });
});

describe("suggestedGrammarTopics", () => {
  it("suggests exactly the six topics of the design for intermediate", () => {
    expect(suggestedGrammarTopics("intermediate").map((topic) => topic.label)).toEqual([
      "Going to vs will",
      "Present simple for the future",
      "Past simple vs present perfect",
      "Conditionals",
      "Prepositions of time",
      "Phrasal verbs",
    ]);
  });

  it("suggests nothing when the level is not set", () => {
    expect(suggestedGrammarTopics(null)).toEqual([]);
  });
});

describe("orderedGrammarTopics", () => {
  it("orders the suggested topics first and keeps catalog order inside each part", () => {
    expect(orderedGrammarTopics("intermediate").map((topic) => topic.id)).toEqual([
      "going_to_vs_will",
      "present_simple_future",
      "past_simple_vs_present_perfect",
      "conditionals",
      "prepositions_of_time",
      "phrasal_verbs",
      "present_perfect",
      "articles",
    ]);
  });

  it("keeps catalog order with no level", () => {
    expect(orderedGrammarTopics(null).map((topic) => topic.id)).toEqual([...GRAMMAR_TOPIC_IDS]);
  });
});

describe("grammarTopicLabel", () => {
  it("labels an id with its catalog label", () => {
    expect(grammarTopicLabel("present_perfect")).toBe("Present perfect");
  });

  it("falls back to the raw id for a topic outside the catalog", () => {
    expect(grammarTopicLabel("subjunctive")).toBe("subjunctive");
  });

  it("does not label a conversation topic as a grammar topic", () => {
    expect(grammarTopicLabel("sports")).toBe("sports");
  });
});
