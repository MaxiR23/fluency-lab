// apps/mobile/test/utils/practice-result.test.ts
//
// Tests for the result of a practice run.
//
// Tested:
// - resultScore scores right over answered
// - resultRows groups the items by rule, or into New words for a words run
// - resultCopy writes the title and the body for the offer and for the end
//
// What is covered:
// - Normal case, empty case, edges
//
// Run with: pnpm exec jest apps/mobile/test/utils/practice-result.test.ts
//
// SEE: apps/mobile/src/utils/practice-result.ts

import { describe, expect, it } from "@jest/globals";

import { resultCopy, resultRows, resultScore } from "@/utils/practice-result";
import { practiceItemWith, practiceRunWith } from "../helpers/fake-data";

const item = (position: number, correct: boolean | null, rule: string) =>
  practiceItemWith({ id: `item-${position}`, position, rule, correct });

describe("resultScore", () => {
  it("scores right over answered", () => {
    const items = [
      item(0, true, "A"),
      item(1, true, "A"),
      item(2, true, "B"),
      item(3, true, "B"),
      item(4, false, "C"),
    ];
    expect(resultScore(items)).toEqual({ right: 4, answered: 5, fraction: 0.8, label: "4/5" });
  });

  it("scores an empty run as 0/0", () => {
    expect(resultScore([])).toEqual({ right: 0, answered: 0, fraction: 0, label: "0/0" });
  });

  it("ignores items not answered", () => {
    expect(resultScore([item(0, true, "A"), item(1, null, "A")])).toMatchObject({
      right: 1,
      answered: 1,
      label: "1/1",
    });
  });
});

describe("resultRows", () => {
  const items = [
    item(0, true, "Going to vs will"),
    item(1, true, "going to vs will"),
    item(2, false, "Present perfect"),
    item(3, true, "Articles"),
  ];

  it("groups the rows by rule in first order", () => {
    expect(resultRows(practiceRunWith(), items)).toEqual([
      { label: "Going to vs will", right: 2, total: 2, allRight: true },
      { label: "Present perfect", right: 0, total: 1, allRight: false },
      { label: "Articles", right: 1, total: 1, allRight: true },
    ]);
  });

  it("marks a row with a miss", () => {
    const rows = resultRows(practiceRunWith(), [item(0, true, "A"), item(1, false, "A")]);
    expect(rows).toEqual([{ label: "A", right: 1, total: 2, allRight: false }]);
  });

  it("groups a words run into New words", () => {
    expect(
      resultRows(practiceRunWith({ focus: "words" }), [
        item(0, true, "definitely"),
        item(1, false, "catchy"),
      ]),
    ).toEqual([{ label: "New words", right: 1, total: 2, allRight: false }]);
  });

  it("returns no rows for no answered items", () => {
    expect(resultRows(practiceRunWith(), [])).toEqual([]);
    expect(resultRows(practiceRunWith({ focus: "words" }), [])).toEqual([]);
    expect(resultRows(practiceRunWith(), [item(0, null, "A")])).toEqual([]);
  });
});

describe("resultCopy", () => {
  const oneMiss = [
    item(0, true, "Articles"),
    item(1, false, "Present perfect"),
    item(2, true, "Articles"),
  ];

  it("writes the offer copy with the first missed rule", () => {
    expect(resultCopy({ name: "Maxi", outcome: "offer", items: oneMiss })).toEqual({
      title: "Almost there, Maxi",
      body: "One slipped. 5 more on present perfect to lock it in.",
    });
  });

  it("counts two misses as Two and more as a number", () => {
    const two = [...oneMiss, item(3, false, "Tenses")];
    expect(resultCopy({ name: "Maxi", outcome: "offer", items: two }).body).toBe(
      "Two slipped. 5 more on present perfect to lock it in.",
    );
    const four = [...two, item(4, false, "Tenses"), item(5, false, "Tenses")];
    expect(resultCopy({ name: "Maxi", outcome: "offer", items: four }).body).toBe(
      "4 slipped. 5 more on present perfect to lock it in.",
    );
  });

  it("writes the copy for no miss and for misses at the end", () => {
    const allRight = [item(0, true, "A"), item(1, true, "A"), item(2, true, "A")];
    expect(resultCopy({ name: "Maxi", outcome: "finished", items: allRight })).toEqual({
      title: "Nice work, Maxi",
      body: "All 3 right.",
    });
    expect(resultCopy({ name: "Maxi", outcome: "finished", items: oneMiss })).toEqual({
      title: "Good work, Maxi",
      body: "2 of 3 right today.",
    });
  });

  it("drops the name when it is not set", () => {
    expect(resultCopy({ name: null, outcome: "offer", items: oneMiss }).title).toBe("Almost there");
    expect(resultCopy({ name: "  ", outcome: "finished", items: oneMiss }).title).toBe("Good work");
    expect(resultCopy({ name: null, outcome: "finished", items: [item(0, true, "A")] }).title).toBe(
      "Nice work",
    );
  });
});
