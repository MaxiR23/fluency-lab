// apps/mobile/test/utils/practice-check.test.ts
//
// Tests for the checks an exercise passes before it is saved, and for the rows that record them.
//
// Tested:
// - sharesSourceWord finds a word of 3+ letters of a translate prompt in its accepted answers
// - similarTo finds a prompt whose content words (no stop, time or number words) overlap an earlier one's by half or more of their union
// - codeCheck compares similarity with the prompts the learner sees, and the slot's rejected prompts only for an exact repeat
// - settleFields sets the rule label and the source by code from the slot
// - codeCheck runs the code check of a written exercise against its slot
// - solverVerdict decides what the blind solver's answer means per kind: a choose mismatch is rejected at once, everything else goes on to the reviewer
// - reviewVerdict and toReview recompute passed from the booleans the kind reads (singleAnswer for a choose only, solverAnswerAccepted never) and pick the reason
// - withSolverAnswer adds an accepted solver answer to a typed exercise, within the limit
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
import type { PracticeSlot } from "@/utils/practice-slots";
import {
  checkExercise,
  codeCheck,
  codeRow,
  graderRow,
  reviewVerdict,
  reviewerRow,
  settleFields,
  sharesSourceWord,
  similarTo,
  solverRow,
  solverVerdict,
  toReview,
  withSolverAnswer,
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

const CLOUDS_CHOOSE = "Look at those dark clouds. It ___ rain in a few minutes.";
const CLOUDS_FIX = "Look at those dark clouds. It is going rain in a few minutes";
const CAR_GAP = "Look at that car, it ___ (crash) into the wall in a second!";
const VASE_GAP = "Watch out! The vase on the table ___ fall.";

describe("similarTo", () => {
  it("finds the clouds fix similar to the clouds choose", () => {
    expect(similarTo(CLOUDS_FIX, CLOUDS_CHOOSE)).toBe(true);
    expect(similarTo(CLOUDS_CHOOSE, CLOUDS_FIX)).toBe(true);
  });

  it("does not find the car gap similar to the clouds choose", () => {
    expect(similarTo(CAR_GAP, CLOUDS_CHOOSE)).toBe(false);
  });

  it("does not find the vase gap similar to the clouds choose or the car gap", () => {
    expect(similarTo(VASE_GAP, CLOUDS_CHOOSE)).toBe(false);
    expect(similarTo(VASE_GAP, CAR_GAP)).toBe(false);
  });

  it("never finds a prompt with fewer than 3 content words similar", () => {
    expect(similarTo("It ___ rain.", CLOUDS_CHOOSE)).toBe(false);
    expect(similarTo("Dark clouds ___.", CLOUDS_CHOOSE)).toBe(false);
    expect(similarTo(CLOUDS_CHOOSE, "Dark clouds ___.")).toBe(false);
  });

  it("ignores the words inside parentheses", () => {
    const cue = "My sister ___ (look dark clouds rain) at home with her dog Rex.";
    expect(similarTo(cue, "Look, dark clouds and rain.")).toBe(false);
    expect(similarTo("Look dark clouds rain at home.", "Look, dark clouds and rain.")).toBe(true);
  });

  it("is similar when shared over union is at least half, and not below", () => {
    expect(similarTo("Anna bought milk.", "Anna bought eggs.")).toBe(true);
    expect(similarTo("Anna bought milk.", "Anna bought eggs and bread.")).toBe(false);
  });

  it("does not find two timetable sentences similar for their time words and subject", () => {
    expect(
      similarTo(
        "The teacher take the train at eight tomorrow morning.",
        "The train to Leeds ___ at 9:15 tomorrow morning.",
      ),
    ).toBe(false);
  });

  it("finds the garden centre sentence similar to itself", () => {
    const garden = "My sister ___ to the garden centre tomorrow morning at nine.";
    expect(similarTo(garden, garden)).toBe(true);
  });

  it("drops the time words, the weekdays and the number words", () => {
    expect(
      similarTo(
        "Ships leave every Monday at seven tonight.",
        "Ships arrive each Monday evening at twelve.",
      ),
    ).toBe(false);
    expect(
      similarTo("Next Saturday night the shop closes.", "Last Sunday night the shop closes."),
    ).toBe(false);
  });

  it("drops the stop words and the gap marker", () => {
    expect(similarTo("They were going to ___ with you.", "They were going to be with you.")).toBe(
      false,
    );
  });
});

describe("settleFields", () => {
  const point = { label: "Timetables: transport", brief: "a train that leaves." };
  const topicSlot = (kind: PracticeSlot["kind"]): PracticeSlot => ({
    position: 0,
    kind,
    target: { focus: "topic", topic: "Present simple for the future", level: null, point },
  });
  const correction = { original: "She go to work.", corrected: "She goes to work.", rule: "Verbs" };

  it("sets the point's label as the rule of a topic exercise", () => {
    expect(settleFields(raw({ rule: "Timetabled events" }), topicSlot("gap")).rule).toBe(
      "Timetables: transport",
    );
  });

  it("sets the learner's rule on a slot built from a correction with a rule", () => {
    const slot = { position: 0, kind: "fix", target: { focus: "mistakes", correction } } as const;
    expect(settleFields(fix, slot)).toMatchObject({ rule: "Verbs", source: fix.source });
  });

  it("keeps the writer's rule for a correction with no rule and for words", () => {
    const noRule = {
      position: 0,
      kind: "choose",
      target: { focus: "mistakes", correction: { ...correction, rule: null } },
    } as const;
    expect(settleFields(choose, noRule).rule).toBe(choose.rule);
    const words = { position: 0, kind: "gap", target: { focus: "words", word: "keen" } } as const;
    expect(settleFields(raw({}), words).rule).toBe("Past simple");
  });

  it("drops the source of anything but a fix on a learner's correction", () => {
    expect(settleFields({ ...fix, source: "x" }, topicSlot("fix")).source).toBe("");
    const chooseOnCorrection = {
      position: 0,
      kind: "choose",
      target: { focus: "mistakes", correction },
    } as const;
    expect(settleFields({ ...choose, source: "x" }, chooseOnCorrection).source).toBe("");
  });
});

describe("codeCheck", () => {
  it("rejects the clouds fix with similar_prompt after the clouds choose", () => {
    const repeated = raw({
      kind: "fix",
      rule: "Going to vs will",
      prompt: CLOUDS_FIX,
      accepted: ["Look at those dark clouds. It is going to rain in a few minutes."],
      source: "",
    });
    expect(codeCheck(repeated, "fix", [CLOUDS_CHOOSE])).toEqual({
      ok: false,
      reason: "similar_prompt",
    });
  });

  it("passes a prompt that is not similar to any in avoid", () => {
    const vase = raw({ prompt: VASE_GAP, accepted: ["is going to"] });
    expect(codeCheck(vase, "gap", [CLOUDS_CHOOSE, CAR_GAP]).ok).toBe(true);
  });

  it("does not reject a prompt close to one of the slot's rejected prompts as similar", () => {
    const close = raw({
      kind: "fix",
      rule: "Going to vs will",
      prompt: CLOUDS_FIX,
      accepted: ["Look at those dark clouds. It is going to rain in a few minutes."],
      source: "",
    });
    expect(codeCheck(close, "fix", [], [CLOUDS_CHOOSE]).ok).toBe(true);
  });

  it("rejects a prompt identical to one of the slot's rejected prompts as repeat", () => {
    expect(codeCheck(choose, "choose", [], ["I ___ to Japan twice."])).toEqual({
      ok: false,
      reason: "repeat",
    });
  });

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

  it("sends a choose to review when the answer matches under normalizeAnswer", () => {
    expect(solverVerdict(chooseDone, { answer: " Have Been. ", alreadyCorrect: false })).toEqual({
      kind: "review",
      solverAnswer: " Have Been. ",
    });
  });

  it("rejects a choose with another option as solver_mismatch", () => {
    expect(solverVerdict(chooseDone, { answer: "was", alreadyCorrect: false })).toEqual({
      kind: "reject",
      reason: "solver_mismatch",
    });
  });

  it("sends a gap to review on a match and on a mismatch", () => {
    expect(solverVerdict(gapDone, { answer: "Went", alreadyCorrect: false })).toEqual({
      kind: "review",
      solverAnswer: "Went",
    });
    expect(solverVerdict(gapDone, { answer: "go", alreadyCorrect: false })).toEqual({
      kind: "review",
      solverAnswer: "go",
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

  it("rejects an empty answer on a choose", () => {
    expect(solverVerdict(chooseDone, { answer: "", alreadyCorrect: false })).toEqual({
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

describe("the paint gap with two fitting forms", () => {
  const paint = saved(
    raw({
      rule: "Going to vs will",
      prompt: "We have bought the paint and the brushes, so we ___ (paint) the kitchen tomorrow.",
      accepted: ["are going to paint"],
    }),
  );

  it("goes to review whatever the solver answers", () => {
    expect(solverVerdict(paint, { answer: "will paint", alreadyCorrect: false })).toEqual({
      kind: "review",
      solverAnswer: "will paint",
    });
  });

  it("is not rejected for a second fitting form, since the grader accepts any right answer", () => {
    const review = toReview({
      singleAnswer: false,
      meaningKept: true,
      answerNotInPrompt: true,
      oneRealMistake: true,
      naturalEnglish: true,
      solverAnswerAccepted: true,
      passed: true,
      reason: "will paint fits too",
    });
    expect(reviewVerdict(review, "gap")).toEqual({ passed: true });
  });
});

describe("withSolverAnswer", () => {
  const gapDone = saved(raw({}));
  const accepting = { ...allTrue, solverAnswerAccepted: true };

  it("adds the solver's answer to a typed exercise when the reviewer accepts it", () => {
    expect(withSolverAnswer(gapDone, "travelled", accepting).accepted).toEqual([
      "went",
      "travelled",
    ]);
  });

  it("does not add an answer already accepted under normalizeAnswer", () => {
    expect(withSolverAnswer(gapDone, " Went. ", accepting).accepted).toEqual(["went"]);
  });

  it("does not add it when the reviewer does not accept it, or to a choose", () => {
    expect(
      withSolverAnswer(gapDone, "travelled", { ...allTrue, solverAnswerAccepted: false }).accepted,
    ).toEqual(["went"]);
    const chooseDone = saved(choose);
    expect(withSolverAnswer(chooseDone, "was", accepting).accepted).toEqual(["have been"]);
  });

  it("keeps accepted within its limit of five", () => {
    const full = saved(raw({ accepted: ["went", "a", "b", "c", "d"] }));
    expect(withSolverAnswer(full, "travelled", accepting).accepted).toHaveLength(5);
  });
});

describe("reviewVerdict", () => {
  it("passes when every boolean is true", () => {
    expect(reviewVerdict(allTrue, "fix")).toEqual({ passed: true });
  });

  it("rejects a model passed true with any false boolean the kind reads", () => {
    const table = [
      ["meaningKept", "meaning_kept"],
      ["answerNotInPrompt", "answer_not_in_prompt"],
      ["oneRealMistake", "one_real_mistake"],
      ["naturalEnglish", "natural_english"],
    ] as const;
    for (const [field, code] of table) {
      expect(reviewVerdict({ ...allTrue, [field]: false, passed: true }, "fix")).toEqual({
        passed: false,
        code,
        reason: code,
      });
    }
  });

  it("reads singleAnswer for a choose only", () => {
    const many = { ...allTrue, singleAnswer: false };
    expect(reviewVerdict(many, "choose")).toEqual({
      passed: false,
      code: "single_answer",
      reason: "single_answer",
    });
    for (const kind of ["gap", "fix", "translate"] as const) {
      expect(reviewVerdict(many, kind)).toEqual({ passed: true });
    }
  });

  it("never rejects on solverAnswerAccepted", () => {
    for (const kind of ["choose", "gap", "fix", "translate"] as const) {
      expect(reviewVerdict({ ...allTrue, solverAnswerAccepted: false }, kind)).toEqual({
        passed: true,
      });
    }
  });

  it("passes a fix with two accepted corrections when oneRealMistake is true", () => {
    const twoCorrections = { ...allTrue, singleAnswer: false, oneRealMistake: true };
    expect(reviewVerdict(twoCorrections, "fix")).toEqual({ passed: true });
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
