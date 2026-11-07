// apps/mobile/test/utils/today-practice.test.ts
//
// Tests for the Home card of today's practice.
//
// Tested:
// - minutesLeft rounds up at 1.2 minutes per exercise
// - todayCard draws today's run, the start state and a finished run
//
// What is covered:
// - Normal case, empty case, edges
//
// Run with: pnpm exec jest apps/mobile/test/utils/today-practice.test.ts
//
// SEE: apps/mobile/src/utils/today-practice.ts

import { describe, expect, it } from "@jest/globals";

import { minutesLeft, todayCard } from "@/utils/today-practice";
import { mistakeGroupWith, practiceItemWith, practiceTodayWith } from "../helpers/fake-data";

const none = { items: [], nextOffset: null };
const answered = (position: number, correct: boolean, rule = "Present perfect") =>
  practiceItemWith({
    id: `item-${position}`,
    position,
    rule,
    correct,
    userAnswer: "x",
    answeredAt: "2026-11-05T10:00:00Z",
  });
const unanswered = (position: number, rule = "Articles") =>
  practiceItemWith({ id: `item-${position}`, position, rule });

describe("minutesLeft", () => {
  it("rounds 3 left up to 4 minutes and 5 left to 6", () => {
    expect(minutesLeft(3)).toBe(4);
    expect(minutesLeft(5)).toBe(6);
  });

  it("is 0 with nothing left and handles 1, 10 and 15", () => {
    expect(minutesLeft(0)).toBe(0);
    expect(minutesLeft(1)).toBe(2);
    expect(minutesLeft(10)).toBe(12);
    expect(minutesLeft(15)).toBe(18);
  });
});

describe("todayCard with a run", () => {
  it("draws today's run with its ring, left and minutes", () => {
    const today = practiceTodayWith([
      answered(0, true),
      answered(1, false, "Articles"),
      unanswered(2),
      unanswered(3),
      unanswered(4),
    ]);
    expect(todayCard({ today, mistakes: none, level: null })).toEqual({
      answered: 2,
      target: 5,
      fraction: 0.4,
      ringLabel: "2/5",
      title: "From your mistakes",
      meta: "3 left · about 4 min",
      chips: ["Present perfect", "Articles"],
      action: "Keep going",
      open: { kind: "run", runId: "run-1" },
    });
  });

  it("shows up to two rule chips without repeats ignoring case", () => {
    const today = practiceTodayWith([
      answered(0, true, "Articles"),
      answered(1, true, "articles"),
      answered(2, true, "Tenses"),
      unanswered(3, "Modals"),
    ]);
    expect(todayCard({ today, mistakes: none, level: null }).chips).toEqual(["Articles", "Tenses"]);
  });

  it("shows the new words chip for a words run", () => {
    const today = practiceTodayWith(
      [answered(0, true, "definitely"), answered(1, true, "Definitely"), unanswered(2, "catchy")],
      { focus: "words" },
    );
    const card = todayCard({ today, mistakes: none, level: null });
    expect(card.chips).toEqual(["2 new words"]);
    expect(card.title).toBe("Your new words");
  });

  it("writes one new word in the singular", () => {
    const today = practiceTodayWith([unanswered(0, "catchy")], { focus: "words" });
    expect(todayCard({ today, mistakes: none, level: null }).chips).toEqual(["1 new word"]);
  });

  it("titles a topic run with the topic", () => {
    const today = practiceTodayWith([], { focus: "topic", topicId: "conditionals" });
    expect(todayCard({ today, mistakes: none, level: null }).title).toBe("Conditionals");
  });

  it("titles a note run From your note", () => {
    const today = practiceTodayWith([unanswered(0)], { focus: "note", noteId: "n1" });
    expect(todayCard({ today, mistakes: none, level: null }).title).toBe("From your note");
  });

  it("draws a run with no items as 0 of its target", () => {
    const card = todayCard({
      today: practiceTodayWith([], { target: 10 }),
      mistakes: none,
      level: null,
    });
    expect(card).toMatchObject({
      ringLabel: "0/10",
      fraction: 0,
      meta: "10 left · about 12 min",
      chips: [],
      action: "Keep going",
    });
  });

  it("draws the result as waiting, not 0 left, at the target while the offer waits", () => {
    const today = practiceTodayWith([0, 1, 2, 3, 4].map((position) => answered(position, true)));
    expect(todayCard({ today, mistakes: none, level: null })).toMatchObject({
      ringLabel: "5/5",
      fraction: 1,
      meta: "Your result is ready",
      action: "Keep going",
      open: { kind: "run", runId: today.run.id },
    });
  });

  it("draws a finished run as done with Practice again", () => {
    const today = practiceTodayWith(
      [0, 1, 2, 3, 4].map((position) => answered(position, true)),
      { finishedAt: "2026-11-05T11:00:00Z" },
    );
    expect(todayCard({ today, mistakes: none, level: null })).toMatchObject({
      fraction: 1,
      meta: "Done for today",
      action: "Practice again",
      open: { kind: "focus" },
    });
  });

  it("opens the run while unfinished and the focus screen otherwise", () => {
    const open = (finishedAt: string | null) =>
      todayCard({
        today: practiceTodayWith([unanswered(0)], { finishedAt }),
        mistakes: none,
        level: null,
      }).open;
    expect(open(null)).toEqual({ kind: "run", runId: "run-1" });
    expect(open("2026-11-05T11:00:00Z")).toEqual({ kind: "focus" });
  });
});

describe("todayCard with no run", () => {
  it("draws the start state with mistakes", () => {
    const mistakes = {
      items: [
        mistakeGroupWith({ rule: "Present perfect" }),
        mistakeGroupWith({ rule: null }),
        mistakeGroupWith({ rule: "Articles" }),
        mistakeGroupWith({ rule: "Tenses" }),
      ],
      nextOffset: null,
    };
    expect(todayCard({ today: null, mistakes, level: "intermediate" })).toEqual({
      answered: 0,
      target: 5,
      fraction: 0,
      ringLabel: "0/5",
      title: "From your mistakes",
      meta: "5 left · about 6 min",
      chips: ["Present perfect", "Articles"],
      action: "Start practice",
      open: { kind: "focus" },
    });
  });

  it("draws the start state with the first suggested topic", () => {
    expect(todayCard({ today: null, mistakes: none, level: "advanced" })).toMatchObject({
      title: "Past simple vs present perfect",
      chips: [],
      action: "Start practice",
      open: { kind: "focus" },
    });
  });

  it("draws the start state with the first topic and no level", () => {
    expect(todayCard({ today: null, mistakes: none, level: null }).title).toBe("Going to vs will");
  });
});
