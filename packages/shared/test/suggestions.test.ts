// packages/shared/test/suggestions.test.ts
//
// Tests for the conversation starter catalog and suggestTopics.
//
// Tested:
// - The catalog covers every topic at every level, with unique ids
// - suggestTopics crosses level, goals and topics with the catalog
//
// What is covered:
// - Normal case, empty case, edges
//
// Run with: pnpm exec vitest run packages/shared/test/suggestions.test.ts
//
// SEE: packages/shared/src/suggestions.ts

import { describe, expect, it } from "vitest";
import { GOALS, LEVELS } from "../src/profile-values";
import {
  STARTERS,
  SUGGESTION_LIMIT,
  suggestTopics,
  type Starter,
  type SuggestionInput,
} from "../src/suggestions";
import { TOPIC_IDS, TOPICS } from "../src/topics";

function starter(overrides: Partial<Starter> & Pick<Starter, "id" | "topicId">): Starter {
  return {
    title: `Title ${overrides.id}`,
    levels: LEVELS,
    goals: [],
    tags: [],
    ...overrides,
  };
}

function input(overrides: Partial<SuggestionInput>): SuggestionInput {
  return { level: "intermediate", goals: [], topics: [], ...overrides };
}

const catalog: readonly Starter[] = [
  starter({ id: "t1", topicId: "technology", tags: ["Apps"] }),
  starter({ id: "t2", topicId: "technology" }),
  starter({ id: "s1", topicId: "sports" }),
  starter({ id: "m1", topicId: "music" }),
  starter({ id: "m2", topicId: "music" }),
];

describe("STARTERS", () => {
  it("has a starter for every topic at every level", () => {
    for (const topic of TOPICS) {
      for (const level of LEVELS) {
        const found = STARTERS.some(
          (entry) => entry.topicId === topic.id && entry.levels.includes(level),
        );
        expect(found, `${topic.id} at ${level}`).toBe(true);
      }
    }
  });

  it("has unique ids", () => {
    const ids = STARTERS.map((entry) => entry.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("only uses known goals", () => {
    for (const entry of STARTERS) {
      for (const goal of entry.goals) {
        expect(GOALS).toContain(goal);
      }
    }
  });
});

describe("suggestTopics", () => {
  it("suggests one starter per profile topic, in the profile's topic order", () => {
    const result = suggestTopics(input({ topics: ["music", "technology", "sports"] }), catalog);
    expect(result.map((entry) => entry.id)).toEqual(["m1", "t1", "s1"]);
  });

  it("only suggests starters that fit the profile's level", () => {
    const levelled = [
      starter({ id: "a", topicId: "food", levels: ["beginner"] }),
      starter({ id: "b", topicId: "food", levels: ["advanced"] }),
    ];
    const result = suggestTopics(input({ level: "advanced", topics: ["food"] }), levelled);
    expect(result.map((entry) => entry.id)).toEqual(["b"]);
  });

  it("ranks a topic's starters by how many profile goals they share", () => {
    const ranked = [
      starter({ id: "none", topicId: "travel", goals: [] }),
      starter({ id: "one", topicId: "travel", goals: ["work"] }),
      starter({ id: "two", topicId: "travel", goals: ["work", "travel"] }),
    ];
    const result = suggestTopics(
      input({ goals: ["work", "travel"], topics: ["travel"] }),
      ranked,
      3,
    );
    expect(result.map((entry) => entry.id)).toEqual(["two", "one", "none"]);
  });

  it("tags each suggestion with its topic label first, then the starter's tags", () => {
    const result = suggestTopics(input({ topics: ["technology"] }), catalog, 1);
    expect(result).toEqual([
      { id: "t1", topicId: "technology", title: "Title t1", tags: ["Technology", "Apps"] },
    ]);
  });

  it("falls back to the whole catalog in catalog order when the profile has no topics", () => {
    const result = suggestTopics(input({ topics: [] }), STARTERS);
    const expected = TOPIC_IDS.slice(0, SUGGESTION_LIMIT);
    expect(result.map((entry) => entry.topicId)).toEqual(expected);
  });

  it("keeps catalog order within a topic when the profile has no goals", () => {
    const result = suggestTopics(input({ topics: ["music"] }), catalog, 2);
    expect(result.map((entry) => entry.id)).toEqual(["m1", "m2"]);
  });

  it("accepts every level when the profile has no level", () => {
    const levelled = [
      starter({ id: "a", topicId: "food", levels: ["beginner"] }),
      starter({ id: "b", topicId: "food", levels: ["advanced"] }),
    ];
    const result = suggestTopics(input({ level: null, topics: ["food"] }), levelled, 5);
    expect(result.map((entry) => entry.id)).toEqual(["a", "b"]);
  });

  it("returns no suggestions from an empty catalog", () => {
    expect(suggestTopics(input({ topics: ["music"] }), [])).toEqual([]);
  });

  it("returns exactly the limit when the topics equal the limit", () => {
    const result = suggestTopics(input({ topics: ["music", "technology", "sports"] }), catalog, 3);
    expect(result).toHaveLength(3);
  });

  it("cuts at the limit with more topics than the limit", () => {
    const result = suggestTopics(input({ topics: ["music", "technology", "sports"] }), catalog, 2);
    expect(result.map((entry) => entry.id)).toEqual(["m1", "t1"]);
  });

  it("fills the limit with a topic's next starters when there are fewer topics than the limit", () => {
    const result = suggestTopics(input({ topics: ["music", "technology"] }), catalog, 3);
    expect(result.map((entry) => entry.id)).toEqual(["m1", "t1", "m2"]);
  });

  it("returns fewer than the limit when the catalog runs out", () => {
    const result = suggestTopics(input({ topics: ["sports"] }), catalog, 3);
    expect(result.map((entry) => entry.id)).toEqual(["s1"]);
  });

  it("returns nothing for a limit of 0", () => {
    expect(suggestTopics(input({ topics: ["music"] }), catalog, 0)).toEqual([]);
  });

  it("skips a topic that has no starter at the profile's level", () => {
    const levelled = [
      starter({ id: "a", topicId: "food", levels: ["beginner"] }),
      starter({ id: "b", topicId: "music", levels: ["advanced"] }),
    ];
    const result = suggestTopics(input({ level: "advanced", topics: ["food", "music"] }), levelled);
    expect(result.map((entry) => entry.id)).toEqual(["b"]);
  });
});
