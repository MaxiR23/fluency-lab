// packages/shared/test/suggestions.test.ts
//
// Tests for the conversation starter catalog, suggestTopics and allSuggestions.
//
// Tested:
// - The catalog is complete, with unique ids and valid topics, goals and levels
// - suggestTopics interleaves interests, goals and new topics for a level
// - allSuggestions lists every starter for a level once
//
// What is covered:
// - Normal case, empty case, edges
//
// Run with: pnpm exec vitest run packages/shared/test/suggestions.test.ts
//
// SEE: packages/shared/src/suggestions.ts

import { describe, expect, it } from "vitest";
import { GOALS, LEVELS, type Goal } from "../src/profile-values";
import {
  STARTERS,
  STARTER_IDS,
  allSuggestions,
  starterById,
  suggestTopics,
  type Starter,
  type SuggestionInput,
} from "../src/suggestions";
import { TOPIC_IDS, type TopicId } from "../src/topics";

type StarterOverrides = { id: string; levels?: Starter["levels"] } & (
  { topicId: TopicId } | { goal: Goal }
);

function starter(overrides: StarterOverrides): Starter {
  const base = {
    id: overrides.id,
    levels: overrides.levels ?? LEVELS,
    title: `Title ${overrides.id}`,
    opener: `Opener ${overrides.id}`,
  };
  if ("topicId" in overrides) return { ...base, topicId: overrides.topicId, goal: null };
  return { ...base, topicId: null, goal: overrides.goal };
}

function input(overrides: Partial<SuggestionInput>): SuggestionInput {
  return { level: "intermediate", goals: [], topics: [], ...overrides };
}

function ids(suggestions: readonly { id: string }[]): string[] {
  return suggestions.map((entry) => entry.id);
}

const catalog: readonly Starter[] = [
  starter({ id: "tv1", topicId: "travel" }),
  starter({ id: "tv2", topicId: "travel" }),
  starter({ id: "w1", goal: "work" }),
  starter({ id: "w2", goal: "work" }),
  starter({ id: "t1", topicId: "technology" }),
  starter({ id: "s1", topicId: "sports" }),
  starter({ id: "e1", goal: "exams" }),
];

describe("STARTERS", () => {
  it("holds the 48 starters of the approved catalog, three per topic and three per goal", () => {
    expect(STARTERS).toHaveLength(48);
    for (const topicId of TOPIC_IDS) {
      expect(STARTERS.filter((entry) => entry.topicId === topicId)).toHaveLength(3);
    }
    for (const goal of GOALS) {
      expect(STARTERS.filter((entry) => entry.goal === goal)).toHaveLength(3);
    }
  });

  it("has unique ids", () => {
    const all = ids(STARTERS);
    expect(new Set(all).size).toBe(all.length);
  });

  it("sets exactly one of topicId and goal on every starter", () => {
    for (const entry of STARTERS) {
      expect((entry.topicId === null) !== (entry.goal === null), entry.id).toBe(true);
    }
  });

  it("uses only catalog topic ids and known goals", () => {
    for (const entry of STARTERS) {
      if (entry.topicId !== null) expect(TOPIC_IDS).toContain(entry.topicId);
      if (entry.goal !== null) expect(GOALS).toContain(entry.goal);
    }
  });

  it("gives every starter a title, an opener and at least one known level", () => {
    for (const entry of STARTERS) {
      expect(entry.title.trim(), entry.id).not.toBe("");
      expect(entry.opener.trim(), entry.id).not.toBe("");
      expect(entry.levels.length, entry.id).toBeGreaterThan(0);
      for (const level of entry.levels) expect(LEVELS).toContain(level);
    }
  });

  it("has a starter for every topic and every goal at every level", () => {
    for (const level of LEVELS) {
      for (const topicId of TOPIC_IDS) {
        const found = STARTERS.some(
          (entry) => entry.topicId === topicId && entry.levels.includes(level),
        );
        expect(found, `${topicId} at ${level}`).toBe(true);
      }
      for (const goal of GOALS) {
        const found = STARTERS.some((entry) => entry.goal === goal && entry.levels.includes(level));
        expect(found, `${goal} at ${level}`).toBe(true);
      }
    }
  });
});

describe("suggestTopics", () => {
  const profile = input({ topics: ["travel"], goals: ["work"] });

  it("interleaves an interest, a goal and a new topic, in that order", () => {
    const result = suggestTopics(profile, catalog, Infinity);
    expect(ids(result)).toEqual(["tv1", "w1", "t1", "tv2", "w2", "s1", "e1"]);
    expect(result.slice(0, 3).map((entry) => entry.tag)).toEqual([
      "Your interests",
      "For your goal",
      "New topic",
    ]);
    expect(result.slice(0, 3).map((entry) => entry.why)).toEqual([
      "Because you like Travel",
      "Useful for work",
      "Something different to try",
    ]);
  });

  it("rotates through the user's topics before taking a second starter of one", () => {
    const small = [
      starter({ id: "m1", topicId: "music" }),
      starter({ id: "m2", topicId: "music" }),
      starter({ id: "t1", topicId: "technology" }),
      starter({ id: "t2", topicId: "technology" }),
    ];
    const result = suggestTopics(input({ topics: ["music", "technology"] }), small, 4);
    expect(ids(result)).toEqual(["m1", "t1", "m2", "t2"]);
  });

  it("only picks starters that fit the level", () => {
    const levelled = [
      starter({ id: "a", topicId: "food", levels: ["beginner"] }),
      starter({ id: "b", topicId: "food", levels: ["advanced"] }),
    ];
    const result = suggestTopics(input({ level: "advanced", topics: ["food"] }), levelled);
    expect(ids(result)).toEqual(["b"]);
  });

  it("takes every level when the level is null", () => {
    const levelled = [
      starter({ id: "a", topicId: "food", levels: ["beginner"] }),
      starter({ id: "b", topicId: "food", levels: ["advanced"] }),
    ];
    const result = suggestTopics(input({ level: null, topics: ["food"] }), levelled);
    expect(ids(result)).toEqual(["a", "b"]);
  });

  it("suggests goals and new topics when the user chose no topics", () => {
    const result = suggestTopics(input({ goals: ["work"] }), catalog, Infinity);
    expect(ids(result)).toEqual(["w1", "t1", "w2", "s1", "tv1", "tv2", "e1"]);
    expect(result.map((entry) => entry.tag)).toEqual([
      "For your goal",
      "New topic",
      "For your goal",
      "New topic",
      "New topic",
      "New topic",
      "New topic",
    ]);
  });

  it("suggests interests and new topics when the user chose no goals", () => {
    const result = suggestTopics(input({ topics: ["travel"] }), catalog, Infinity);
    expect(ids(result)).toEqual(["tv1", "t1", "tv2", "s1", "w1", "e1", "w2"]);
    expect(result.slice(0, 2).map((entry) => entry.tag)).toEqual(["Your interests", "New topic"]);
  });

  it("suggests only new topics when the user chose nothing", () => {
    const result = suggestTopics(input({}), catalog, Infinity);
    expect(result.every((entry) => entry.tag === "New topic")).toBe(true);
    expect(result).toHaveLength(catalog.length);
    expect(result.every((entry) => entry.why === "Something different to try")).toBe(true);
  });

  it("suggests no new topic when the user chose every topic and every goal", () => {
    const result = suggestTopics(
      input({ level: null, topics: [...TOPIC_IDS], goals: [...GOALS] }),
      STARTERS,
      Infinity,
    );
    expect(result).toHaveLength(STARTERS.length);
    expect(result.some((entry) => entry.tag === "New topic")).toBe(false);
  });

  it("never picks the same starter twice", () => {
    for (const level of LEVELS) {
      const result = allSuggestions(input({ level, topics: ["music", "travel"], goals: ["work"] }));
      expect(new Set(ids(result)).size).toBe(result.length);
    }
  });

  it("stops at the limit", () => {
    expect(suggestTopics(profile, STARTERS, 6)).toHaveLength(6);
    expect(ids(suggestTopics(profile, catalog, 1))).toEqual(["tv1"]);
  });

  it("returns nothing for a limit of zero", () => {
    expect(suggestTopics(profile, catalog, 0)).toEqual([]);
  });

  it("returns nothing for an empty catalog", () => {
    expect(suggestTopics(profile, [])).toEqual([]);
  });

  it("keeps going with the other queues when one runs out", () => {
    const result = suggestTopics(
      input({ topics: ["travel"], goals: ["work"] }),
      [
        starter({ id: "tv1", topicId: "travel" }),
        starter({ id: "tv2", topicId: "travel" }),
        starter({ id: "tv3", topicId: "travel" }),
      ],
      3,
    );
    expect(ids(result)).toEqual(["tv1", "tv2", "tv3"]);
  });

  it("uses the lower case goal label in the why line", () => {
    const result = suggestTopics(input({ goals: ["conversation"] }), [
      starter({ id: "c1", goal: "conversation" }),
    ]);
    expect(result[0]?.why).toBe("Useful for everyday conversation");
  });

  it("carries the starter's opener, topic and goal", () => {
    const result = suggestTopics(profile, catalog, 2);
    expect(result[0]).toEqual({
      id: "tv1",
      title: "Title tv1",
      opener: "Opener tv1",
      topicId: "travel",
      goal: null,
      tag: "Your interests",
      why: "Because you like Travel",
    });
    expect(result[1]).toMatchObject({ id: "w1", topicId: null, goal: "work" });
  });
});

describe("allSuggestions", () => {
  it("lists every starter for the level exactly once", () => {
    for (const level of LEVELS) {
      const expected = STARTERS.filter((entry) => entry.levels.includes(level)).map(
        (entry) => entry.id,
      );
      const result = ids(allSuggestions(input({ level, topics: ["music"], goals: ["exams"] })));
      expect([...result].sort()).toEqual([...expected].sort());
    }
  });

  it("tags a starter of a goal the user did not choose as a new topic", () => {
    const result = allSuggestions(input({ goals: ["work"] }), catalog);
    const exams = result.find((entry) => entry.id === "e1");
    expect(exams).toMatchObject({ tag: "New topic", why: "Something different to try" });
  });
});

describe("starterById", () => {
  it("finds a known starter", () => {
    expect(starterById("tech-app")).toBe(STARTERS.find((entry) => entry.id === "tech-app"));
  });

  it("returns undefined for an unknown id", () => {
    expect(starterById("nope")).toBeUndefined();
  });
});

describe("STARTER_IDS", () => {
  it("lists every starter id in order", () => {
    expect([...STARTER_IDS]).toEqual(STARTERS.map((entry) => entry.id));
  });
});
