// apps/mobile/test/utils/practice-focus.test.ts
//
// Tests for the model of the practice focus screen and the route params of a practice.
//
// Tested:
// - focusModel: the mistakes and words rows, the topics and the suggested label
// - defaultFocus, listSummary, focusLabel
// - practiceParams, notePracticeParams and practiceOrigin
// - focusFromReads and focusReducer
//
// What is covered:
// - Normal case, empty case, edges
//
// Run with: pnpm exec jest apps/mobile/test/utils/practice-focus.test.ts
//
// SEE: apps/mobile/src/utils/practice-focus.ts

import { describe, expect, it } from "@jest/globals";

import {
  defaultFocus,
  focusFromReads,
  focusLabel,
  focusModel,
  focusReducer,
  initialFocus,
  listSummary,
  notePracticeParams,
  practiceOrigin,
  practiceParams,
} from "@/utils/practice-focus";
import { completedProfile, mistakeGroupWith, newWordWith } from "../helpers/fake-data";

const none = { items: [], nextOffset: null };
const mistakes = (rules: (string | null)[], nextOffset: number | null = null) => ({
  items: rules.map((rule) => mistakeGroupWith({ rule })),
  nextOffset,
});
const words = (list: string[], nextOffset: number | null = null) => ({
  items: list.map((word) => newWordWith({ word })),
  nextOffset,
});

describe("listSummary", () => {
  it("names two and the count of the rest", () => {
    expect(listSummary(["Present perfect", "Articles", "Tenses", "Modals"], false)).toBe(
      "Present perfect, articles and 2 more",
    );
  });

  it("adds a plus when there is a next page", () => {
    expect(listSummary(["A", "B", "C", "D"], true)).toBe("A, b and 2+ more");
  });

  it("names one with no rest", () => {
    expect(listSummary(["Articles"], false)).toBe("Articles");
  });

  it("names two joined with and", () => {
    expect(listSummary(["Present perfect", "Articles"], false)).toBe(
      "Present perfect and articles",
    );
  });

  it("says more when the next page is all that is left", () => {
    expect(listSummary(["A", "B"], true)).toBe("A, b and more");
    expect(listSummary(["A"], true)).toBe("A and more");
  });

  it("lower-cases the second name's first letter", () => {
    expect(listSummary(["Articles", "Present perfect", "Tenses"], false)).toBe(
      "Articles, present perfect and 1 more",
    );
  });
});

describe("focusModel", () => {
  it("shows mistakes and words with their summaries", () => {
    const model = focusModel({
      mistakes: mistakes(["Present perfect", "Articles", "Tenses", "Modals"]),
      words: words(["definitely", "set foot in"]),
      level: "intermediate",
    });
    expect(model.mistakes).toEqual({ subtitle: "Present perfect, articles and 2 more" });
    expect(model.words).toEqual({ subtitle: "definitely and set foot in" });
  });

  it("skips the groups with no rule when naming mistakes", () => {
    const model = focusModel({
      mistakes: mistakes([null, "Articles"]),
      words: none,
      level: null,
    });
    expect(model.mistakes).toEqual({ subtitle: "Articles" });
  });

  it("describes mistakes with no named rule", () => {
    const model = focusModel({ mistakes: mistakes([null]), words: none, level: null });
    expect(model.mistakes).toEqual({ subtitle: "Your latest corrections" });
  });

  it("shows only topics with no mistakes and no words", () => {
    const model = focusModel({ mistakes: none, words: none, level: "intermediate" });
    expect(model.mistakes).toBeNull();
    expect(model.words).toBeNull();
    expect(model.topics).toHaveLength(8);
  });

  it("puts the suggested topics first with the level label", () => {
    const model = focusModel({ mistakes: none, words: none, level: "intermediate" });
    expect(model.suggestedLabel).toBe("Suggested for Intermediate");
    expect(model.topics.slice(0, 6).map((topic) => topic.label)).toEqual([
      "Going to vs will",
      "Present simple for the future",
      "Past simple vs present perfect",
      "Conditionals",
      "Prepositions of time",
      "Phrasal verbs",
    ]);
  });

  it("shows no label and catalog order with no level", () => {
    const model = focusModel({ mistakes: none, words: none, level: null });
    expect(model.suggestedLabel).toBeNull();
    expect(model.topics[0]?.id).toBe("going_to_vs_will");
    expect(model.topics[3]?.id).toBe("present_perfect");
  });
});

describe("defaultFocus", () => {
  it("selects mistakes by default when there are any", () => {
    const model = focusModel({ mistakes: mistakes(["A"]), words: words(["x"]), level: "beginner" });
    expect(defaultFocus(model)).toEqual({ kind: "mistakes" });
  });

  it("selects the first suggested topic with no mistakes", () => {
    const model = focusModel({ mistakes: none, words: words(["x"]), level: "advanced" });
    expect(defaultFocus(model)).toEqual({
      kind: "topic",
      topicId: "past_simple_vs_present_perfect",
    });
  });

  it("selects the first topic with no mistakes and no level", () => {
    const model = focusModel({ mistakes: none, words: none, level: null });
    expect(defaultFocus(model)).toEqual({ kind: "topic", topicId: "going_to_vs_will" });
  });
});

describe("focusLabel", () => {
  it("labels each choice", () => {
    expect(focusLabel({ kind: "mistakes" })).toBe("From your mistakes");
    expect(focusLabel({ kind: "words" })).toBe("Your new words");
    expect(focusLabel({ kind: "topic", topicId: "articles" })).toBe("Articles");
  });
});

describe("practiceParams and practiceOrigin", () => {
  it("writes the params of each choice", () => {
    expect(practiceParams({ kind: "mistakes" }, 10)).toEqual({ focus: "mistakes", target: "10" });
    expect(practiceParams({ kind: "topic", topicId: "articles" }, 5)).toEqual({
      focus: "topic",
      topic: "articles",
      target: "5",
    });
  });

  it("builds the params of a note practice of five", () => {
    expect(notePracticeParams("n1")).toEqual({ focus: "note", note: "n1", target: "5" });
  });

  it("reads a note focus with its note", () => {
    expect(practiceOrigin({ focus: "note", note: "n1", target: "5" })).toEqual({
      kind: "new",
      input: { focus: "note", noteId: "n1", target: 5 },
    });
  });

  it("returns null for a note focus without a note", () => {
    expect(practiceOrigin({ focus: "note", target: "5" })).toBeNull();
    expect(practiceOrigin({ focus: "note", note: "", target: "5" })).toBeNull();
  });

  it("prefers a run id", () => {
    expect(practiceOrigin({ run: "run-1", focus: "words", target: "5" })).toEqual({
      kind: "resume",
      runId: "run-1",
    });
  });

  it("reads a topic run", () => {
    expect(practiceOrigin({ focus: "topic", topic: "articles", target: "15" })).toEqual({
      kind: "new",
      input: { focus: "topic", topicId: "articles", target: 15 },
    });
    expect(practiceOrigin({ focus: "mistakes", target: "10" })).toEqual({
      kind: "new",
      input: { focus: "mistakes", target: 10 },
    });
  });

  it("rejects an unknown focus, topic or target", () => {
    expect(practiceOrigin({ focus: "chat", target: "5" })).toBeNull();
    expect(practiceOrigin({ focus: "topic", topic: "sports", target: "5" })).toBeNull();
    expect(practiceOrigin({ focus: "topic", target: "5" })).toBeNull();
    expect(practiceOrigin({ focus: "words", target: "7" })).toBeNull();
    expect(practiceOrigin({})).toBeNull();
  });

  it("defaults the target to 5", () => {
    expect(practiceOrigin({ focus: "words" })).toEqual({
      kind: "new",
      input: { focus: "words", target: 5 },
    });
  });

  it("reads the first of repeated params", () => {
    expect(practiceOrigin({ focus: ["words", "mistakes"], target: ["10"] })).toEqual({
      kind: "new",
      input: { focus: "words", target: 10 },
    });
  });
});

describe("focusFromReads and focusReducer", () => {
  const profile = { ok: true, value: completedProfile() } as const;
  const page = { ok: true, value: none } as const;

  it("is ready with the three reads", () => {
    const state = focusFromReads(profile, page, page);
    expect(state.kind).toBe("ready");
  });

  it("fails on any read", () => {
    const failed = { ok: false, failure: "network" } as const;
    expect(focusFromReads(failed, page, page)).toEqual({ kind: "failed", failure: "network" });
    expect(focusFromReads(profile, failed, page)).toEqual({ kind: "failed", failure: "network" });
    expect(focusFromReads(profile, page, failed)).toEqual({ kind: "failed", failure: "network" });
  });

  it("starts loading and goes back to loading when a load starts", () => {
    expect(initialFocus).toEqual({ kind: "loading" });
    const ready = focusFromReads(profile, page, page);
    expect(focusReducer(ready, { type: "load_started" })).toEqual({ kind: "loading" });
  });

  it("is ready with the model of the learner's level", () => {
    const state = focusReducer(initialFocus, {
      type: "loaded",
      profile: { ok: true, value: { ...completedProfile(), level: "intermediate" } },
      mistakes: page,
      words: page,
    });
    expect(state.kind === "ready" && state.model.suggestedLabel).toBe("Suggested for Intermediate");
  });
});
