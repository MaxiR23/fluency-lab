// packages/shared/test/grammar-topics.test.ts
//
// Tests for the grammar topic catalog of the daily practice.
//
// Tested:
// - The eight topics in catalog order, with unique ids
// - Which topics each level suggests
// - The order that puts the suggested topics first
// - TOPIC_POINTS gives every topic at least three points, with short unique labels; topicPoints reads them by id
// - CONTRAST_TOPIC_IDS names the usage contrasts, all in the catalog
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
  CONTRAST_TOPIC_IDS,
  TOPIC_POINTS,
  topicPoints,
  GRAMMAR_TOPICS,
  GRAMMAR_TOPIC_IDS,
  grammarTopicLabel,
  orderedGrammarTopics,
  suggestedGrammarTopics,
} from "../src/grammar-topics";

describe("TOPIC_POINTS", () => {
  it("gives every topic at least three points with a brief", () => {
    for (const id of GRAMMAR_TOPIC_IDS) {
      expect(TOPIC_POINTS[id].length).toBeGreaterThanOrEqual(3);
      for (const point of TOPIC_POINTS[id]) expect(point.brief.length).toBeGreaterThan(0);
    }
  });

  it("keeps every label at most 32 characters and unique within its topic", () => {
    for (const id of GRAMMAR_TOPIC_IDS) {
      const labels = TOPIC_POINTS[id].map((point) => point.label);
      for (const label of labels) expect(label.length).toBeLessThanOrEqual(32);
      expect(new Set(labels).size).toBe(labels.length);
    }
  });

  it("lists the points of going to vs will in order", () => {
    expect(TOPIC_POINTS.going_to_vs_will.map((point) => point.label)).toEqual([
      "Will: instant decisions",
      "Going to: plans",
      "Going to: evidence now",
      "Will: predictions",
      "Will: offers and promises",
    ]);
  });

  it("keeps the word to outside the gap in the been or gone point", () => {
    expect(TOPIC_POINTS.present_perfect.find((point) => point.label === "Been or gone")).toEqual({
      label: "Been or gone",
      brief:
        '"has been" against "has gone" for a visit or a trip; the word "to" stays in the sentence, outside the gap and outside the options.',
    });
  });

  it("names the subject of a timetable point", () => {
    expect(TOPIC_POINTS.present_simple_future[0]).toEqual({
      label: "Timetables: transport",
      brief:
        "a train, bus, flight or ferry that leaves, departs or arrives at a fixed time; the subject is the transport.",
    });
  });
});

describe("topicPoints", () => {
  it("returns the points of a catalog topic", () => {
    expect(topicPoints("articles")).toBe(TOPIC_POINTS.articles);
  });

  it("returns no point for an id outside the catalog or no id", () => {
    expect(topicPoints("subjunctive")).toEqual([]);
    expect(topicPoints(null)).toEqual([]);
  });
});

describe("CONTRAST_TOPIC_IDS", () => {
  it("lists the three usage contrasts, every one in the catalog", () => {
    expect(CONTRAST_TOPIC_IDS).toEqual([
      "going_to_vs_will",
      "past_simple_vs_present_perfect",
      "present_simple_future",
    ]);
    for (const id of CONTRAST_TOPIC_IDS) expect(GRAMMAR_TOPIC_IDS).toContain(id);
    expect(GRAMMAR_TOPICS.filter((topic) => CONTRAST_TOPIC_IDS.includes(topic.id))).toHaveLength(3);
  });
});

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
