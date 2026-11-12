// apps/mobile/test/utils/practice-check.test.ts
//
// Tests for the checks an exercise passes before it is saved, and for the rows that record them.
//
// Tested:
// - sharesSourceWord finds a word of 3+ letters of a translate prompt in its accepted answers
// - codeCheck runs the code check of a written exercise against its slot
// - solverVerdict decides what the blind solver's answer means per kind
// - reviewVerdict and toReview recompute passed from the booleans and pick the reason
// - checkExercise bounds an exercise for a check row
// - codeRow, solverRow, reviewerRow and graderRow build the rows that are saved
//
// What is covered:
// - Normal case, empty case, edges
//
// Run with: pnpm exec jest apps/mobile/test/utils/practice-check.test.ts
//
// SEE: apps/mobile/src/utils/practice-check.ts

import { describe, expect, it } from "@jest/globals";
import { TUTOR_MODEL, type PracticeExercisePayload } from "@fluency-lab/shared";

import type { PracticeExercise } from "@/ai/ai-port";
import {
  checkExercise,
  codeCheck,
  codeRow,
  graderRow,
  reviewVerdict,
  reviewerRow,
  sharesSourceWord,
  solverRow,
  solverVerdict,
  toReview,
} from "@/utils/practice-check";

const raw = (overrides: Partial<PracticeExercisePayload>): PracticeExercisePayload => ({
  kind: "gap",
  rule: "Past simple",
  prompt: "I ___ (go) to Japan last year.",
  options: [],
  accepted: ["went"],
  explanation: "Past simple.",
  source: "",
  ...overrides,
});

const choose = raw({
  kind: "choose",
  prompt: "I ___ to Japan twice.",
  options: ["have been", "was", "am"],
  accepted: ["have been"],
});
const fix = raw({
  kind: "fix",
  prompt: "She go to work every day.",
  accepted: ["She goes to work every day."],
  source: "She go to work every day.",
});
const translate = raw({
  kind: "translate",
  prompt: "Fui a Japón dos veces.",
  accepted: ["I went to Japan twice."],
});

function saved(payload: PracticeExercisePayload): PracticeExercise {
  return {
    kind: payload.kind as PracticeExercise["kind"],
    rule: payload.rule,
    prompt: payload.prompt,
    options: payload.options.length === 0 ? null : payload.options,
    accepted: payload.accepted,
    explanation: payload.explanation,
    source: payload.source === "" ? null : payload.source,
  };
}

describe("sharesSourceWord", () => {
  it("finds Ella in a translate whose answer keeps it", () => {
    expect(
      sharesSourceWord("Ella decidió dejar de fumar.", ["Ella decided to give up smoking."]),
    ).toBe(true);
  });

  it("ignores words of two letters", () => {
    expect(sharesSourceWord("Voy a la playa.", ["I go to the beach, a la carte."])).toBe(false);
    expect(sharesSourceWord("Es un día.", ["It is a day. Es"])).toBe(false);
  });

  it("ignores numbers", () => {
    expect(sharesSourceWord("Tengo 2020 libros.", ["I have 2020 books."])).toBe(false);
  });

  it("matches without case", () => {
    expect(sharesSourceWord("ELLA come.", ["She said ella eats."])).toBe(true);
  });

  it("reads accented letters as part of a word", () => {
    expect(sharesSourceWord("Ella decidió ir.", ["He decidi went."])).toBe(false);
    expect(sharesSourceWord("Ella decidió ir.", ["He decidió to go."])).toBe(true);
  });

  it("is false with no shared word", () => {
    expect(sharesSourceWord("Fui a Japón dos veces.", ["I went to Japan twice."])).toBe(false);
  });

  it("is false for an empty accepted list", () => {
    expect(sharesSourceWord("Ella decidió ir.", [])).toBe(false);
  });

  it("matches exactly three letters and not two", () => {
    expect(sharesSourceWord("Yo vi el sol.", ["I saw the sol."])).toBe(true);
    expect(sharesSourceWord("Yo vi el sol.", ["I saw the so."])).toBe(false);
    expect(sharesSourceWord("Yo vi al.", ["I saw al."])).toBe(false);
  });
});

describe("codeCheck", () => {
  it("passes a valid exercise of the slot's kind", () => {
    const result = codeCheck(choose, "choose", []);
    expect(result.ok && result.exercise.kind).toBe("choose");
  });

  it("rejects the Ella translate with translate_source_word", () => {
    const ella = raw({
      kind: "translate",
      prompt: "Ella decidió dejar de fumar.",
      accepted: ["Ella decided to give up smoking."],
    });
    expect(codeCheck(ella, "translate", [])).toEqual({
      ok: false,
      reason: "translate_source_word",
    });
  });

  it("rejects the fix 'She picked up the phone and looked after it carefully.' whose accepted answer equals its prompt with fix_already_answer", () => {
    const already = raw({
      kind: "fix",
      prompt: "She picked up the phone and looked after it carefully.",
      accepted: ["She picked up the phone and looked after it carefully."],
      source: "",
    });
    expect(codeCheck(already, "fix", [])).toEqual({ ok: false, reason: "fix_already_answer" });
  });

  it("rejects a kind other than the slot's with wrong_kind", () => {
    expect(codeCheck(choose, "gap", [])).toEqual({ ok: false, reason: "wrong_kind" });
  });

  it("rejects a prompt in avoid after normalizing with repeat", () => {
    expect(codeCheck(choose, "choose", ["i ___ to japan twice"])).toEqual({
      ok: false,
      reason: "repeat",
    });
  });

  it("passes with an empty avoid", () => {
    expect(codeCheck(fix, "fix", []).ok).toBe(true);
    expect(codeCheck(translate, "translate", []).ok).toBe(true);
  });

  it("reports the limits of toExercise with their codes", () => {
    expect(codeCheck(raw({ accepted: [] }), "gap", [])).toEqual({ ok: false, reason: "limit" });
    expect(codeCheck(raw({ prompt: "No gap here." }), "gap", [])).toEqual({
      ok: false,
      reason: "gap_count",
    });
  });
});

describe("solverVerdict", () => {
  const chooseDone = saved(choose);
  const gapDone = saved(raw({}));
  const fixDone = saved(fix);
  const translateDone = saved(translate);

  it("passes a choose when the answer matches under normalizeAnswer", () => {
    expect(solverVerdict(chooseDone, { answer: " Have Been. ", alreadyCorrect: false })).toEqual({
      kind: "pass",
    });
  });

  it("rejects a choose with another option as solver_mismatch", () => {
    expect(solverVerdict(chooseDone, { answer: "was", alreadyCorrect: false })).toEqual({
      kind: "reject",
      reason: "solver_mismatch",
    });
  });

  it("passes a gap on a match and rejects a mismatch", () => {
    expect(solverVerdict(gapDone, { answer: "Went", alreadyCorrect: false })).toEqual({
      kind: "pass",
    });
    expect(solverVerdict(gapDone, { answer: "go", alreadyCorrect: false })).toEqual({
      kind: "reject",
      reason: "solver_mismatch",
    });
  });

  it("rejects a fix the solver calls already correct as solver_already_correct", () => {
    expect(solverVerdict(fixDone, { answer: fix.prompt, alreadyCorrect: true })).toEqual({
      kind: "reject",
      reason: "solver_already_correct",
    });
  });

  it("sends a fix to review with the solver's answer", () => {
    expect(
      solverVerdict(fixDone, { answer: "She goes to work every day.", alreadyCorrect: false }),
    ).toEqual({ kind: "review", solverAnswer: "She goes to work every day." });
  });

  it("sends a translate to review with the solver's answer, ignoring alreadyCorrect", () => {
    expect(
      solverVerdict(translateDone, { answer: "I went to Japan twice.", alreadyCorrect: true }),
    ).toEqual({ kind: "review", solverAnswer: "I went to Japan twice." });
  });

  it("rejects an empty answer on a choose or gap", () => {
    expect(solverVerdict(chooseDone, { answer: "", alreadyCorrect: false })).toEqual({
      kind: "reject",
      reason: "solver_mismatch",
    });
    expect(solverVerdict(gapDone, { answer: "  ", alreadyCorrect: false })).toEqual({
      kind: "reject",
      reason: "solver_mismatch",
    });
  });
});

const allTrue = {
  singleAnswer: true,
  meaningKept: true,
  answerNotInPrompt: true,
  oneRealMistake: true,
  naturalEnglish: true,
  solverAnswerAccepted: true,
  reason: null,
};

describe("reviewVerdict", () => {
  it("passes when every boolean is true", () => {
    expect(reviewVerdict(allTrue, "fix")).toEqual({ passed: true });
  });

  it("rejects a model passed true with any false boolean", () => {
    const table = [
      ["singleAnswer", "single_answer"],
      ["meaningKept", "meaning_kept"],
      ["answerNotInPrompt", "answer_not_in_prompt"],
      ["oneRealMistake", "one_real_mistake"],
      ["naturalEnglish", "natural_english"],
      ["solverAnswerAccepted", "solver_answer_accepted"],
    ] as const;
    for (const [field, code] of table) {
      expect(reviewVerdict({ ...allTrue, [field]: false, passed: true }, "fix")).toEqual({
        passed: false,
        code,
        reason: code,
      });
    }
  });

  it("reads oneRealMistake for a fix only; it is true otherwise", () => {
    const noMistake = { ...allTrue, oneRealMistake: false };
    expect(reviewVerdict(noMistake, "translate")).toEqual({ passed: true });
    expect(reviewVerdict(noMistake, "fix")).toEqual({
      passed: false,
      code: "one_real_mistake",
      reason: "one_real_mistake",
    });
  });

  it("reports the first false boolean in order", () => {
    expect(reviewVerdict({ ...allTrue, naturalEnglish: false, meaningKept: false }, "fix")).toEqual(
      {
        passed: false,
        code: "meaning_kept",
        reason: "meaning_kept",
      },
    );
  });

  it("appends the model's reason when present and cuts it at 300", () => {
    expect(
      reviewVerdict({ ...allTrue, naturalEnglish: false, reason: "Sounds odd." }, "fix"),
    ).toEqual({
      passed: false,
      code: "natural_english",
      reason: "natural_english: Sounds odd.",
    });
    const long = reviewVerdict(
      { ...allTrue, naturalEnglish: false, reason: "x".repeat(400) },
      "fix",
    );
    expect(long.passed === false && long.reason).toHaveLength(300);
  });
});

describe("toReview", () => {
  const payload = { ...allTrue, passed: false, reason: "" };

  it("recomputes passed as the AND of the booleans", () => {
    expect(toReview(payload).passed).toBe(true);
    expect(toReview({ ...payload, meaningKept: false, passed: true }).passed).toBe(false);
  });

  it("turns an empty reason into null and trims a present one", () => {
    expect(toReview(payload).reason).toBeNull();
    expect(toReview({ ...payload, reason: "  " }).reason).toBeNull();
    expect(toReview({ ...payload, reason: " ok " }).reason).toBe("ok");
  });
});

describe("the row builders", () => {
  const model = TUTOR_MODEL;

  it("builds a code row with no checker model", () => {
    expect(codeRow({ generatorModel: model, exercise: choose, reason: null })).toEqual({
      stage: "code",
      generatorModel: model,
      checkerModel: null,
      passed: true,
      reason: null,
      solverAnswer: null,
      exercise: checkExercise(choose),
    });
  });

  it("builds a failed row with its reason", () => {
    const row = codeRow({ generatorModel: model, exercise: choose, reason: "repeat" });
    expect(row).toMatchObject({ passed: false, reason: "repeat" });
  });

  it("builds a solver row with the solver's answer and its model", () => {
    const row = solverRow({
      generatorModel: model,
      checkerModel: model,
      exercise: saved(choose),
      answer: "was",
      reason: "solver_mismatch",
    });
    expect(row).toMatchObject({
      stage: "solver",
      checkerModel: model,
      passed: false,
      reason: "solver_mismatch",
      solverAnswer: "was",
    });
  });

  it("builds a reviewer row from the verdict", () => {
    const passed = reviewerRow({
      generatorModel: model,
      checkerModel: model,
      exercise: saved(fix),
      solverAnswer: "She goes to work every day.",
      verdict: { passed: true },
    });
    expect(passed).toMatchObject({ stage: "reviewer", passed: true, reason: null });
    const failed = reviewerRow({
      generatorModel: model,
      checkerModel: model,
      exercise: saved(fix),
      solverAnswer: "x",
      verdict: { passed: false, code: "meaning_kept", reason: "meaning_kept: Changed." },
    });
    expect(failed).toMatchObject({
      passed: false,
      reason: "meaning_kept: Changed.",
      solverAnswer: "x",
    });
  });

  it("builds a grader row passed false with grader_flawed", () => {
    expect(
      graderRow({ generatorModel: model, checkerModel: model, exercise: saved(fix), flawed: true }),
    ).toMatchObject({ stage: "grader", passed: false, reason: "grader_flawed" });
  });

  it("builds a grader row passed true with no reason", () => {
    expect(
      graderRow({
        generatorModel: model,
        checkerModel: model,
        exercise: saved(fix),
        flawed: false,
      }),
    ).toMatchObject({ stage: "grader", passed: true, reason: null });
  });

  it("cuts every exercise string at 1000 and every list at 10", () => {
    const big = raw({
      kind: "k".repeat(60),
      rule: "r".repeat(1500),
      prompt: "p".repeat(1500),
      explanation: "e".repeat(1500),
      source: "s".repeat(1500),
      options: Array.from({ length: 12 }, () => "o".repeat(1500)),
      accepted: Array.from({ length: 12 }, () => "a".repeat(1500)),
    });
    const bounded = checkExercise(big);
    expect(bounded.kind).toHaveLength(40);
    expect(bounded.rule).toHaveLength(1000);
    expect(bounded.prompt).toHaveLength(1000);
    expect(bounded.explanation).toHaveLength(1000);
    expect(bounded.source).toHaveLength(1000);
    expect(bounded.options).toHaveLength(10);
    expect(bounded.options[0]).toHaveLength(1000);
    expect(bounded.accepted).toHaveLength(10);
  });

  it("writes a saved exercise's null options and source as empty", () => {
    expect(checkExercise(saved(fix))).toMatchObject({ options: [], source: fix.source });
    expect(checkExercise(saved(raw({}))).options).toEqual([]);
  });

  it("turns an empty or over 300 solver answer into null or a 300 cut", () => {
    const row = (answer: string) =>
      solverRow({
        generatorModel: model,
        checkerModel: model,
        exercise: saved(choose),
        answer,
        reason: null,
      });
    expect(row("").solverAnswer).toBeNull();
    expect(row("   ").solverAnswer).toBeNull();
    expect(row("x".repeat(400)).solverAnswer).toHaveLength(300);
  });
});
