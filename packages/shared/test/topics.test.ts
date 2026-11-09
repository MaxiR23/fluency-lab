// packages/shared/test/topics.test.ts
//
// Tests for the topic catalog.
//
// Tested:
// - The twelve topics in catalog order, with unique ids and English labels
// - topicLabel returns the label of a topic id, and the raw id for one outside the catalog
//
// What is covered:
// - Normal case, empty case, edges
//
// Run with: pnpm exec vitest run packages/shared/test/topics.test.ts
//
// SEE: packages/shared/src/topics.ts

import { describe, expect, it } from "vitest";
import { TOPICS, TOPIC_IDS, topicLabel } from "../src/topics";

describe("TOPICS", () => {
  it("lists the twelve topics in catalog order", () => {
    expect(TOPIC_IDS).toEqual([
      "technology",
      "sports",
      "music",
      "movies_and_series",
      "food",
      "travel",
      "gaming",
      "job_interviews",
      "books",
      "health_and_fitness",
      "science",
      "daily_life",
    ]);
  });

  it("has unique ids", () => {
    expect(new Set(TOPIC_IDS).size).toBe(TOPICS.length);
  });

  it("has no topic without an id", () => {
    expect(TOPICS.every((topic) => topic.id.length > 0)).toBe(true);
  });

  it("gives each topic a non-empty English label", () => {
    expect(TOPICS.every((topic) => topic.label.trim() !== "")).toBe(true);
  });
});

describe("topicLabel", () => {
  it("returns the label of a topic id", () => {
    expect(topicLabel("job_interviews")).toBe("Job interviews");
  });

  it("falls back to the raw id for a topic outside the catalog", () => {
    expect(topicLabel("cooking")).toBe("cooking");
  });

  it("returns an empty id as it is", () => {
    expect(topicLabel("")).toBe("");
  });
});
