// apps/mobile/test/ai/claude-ai-models.test.ts
//
// Tests that the provider adapter sends and reports the model each call is given.
//
// Tested:
// - practiceExercise, solveExercise and reviewExercise send their own model in the body and report it
// - reply and gradeAnswer send and report the tutor model
//
// What is covered:
// - Normal case: the four model constants are equal in the app, so the constants are mocked to differ
//
// Run with: pnpm exec jest apps/mobile/test/ai/claude-ai-models.test.ts
//
// SEE: apps/mobile/src/ai/claude-ai.ts

import { describe, expect, it, jest } from "@jest/globals";
import { TUTOR_MODEL } from "@fluency-lab/shared";

import { createClaudeAi } from "@/ai/claude-ai";
import { generatedSecret } from "../helpers/generated-secret";

jest.mock("@fluency-lab/shared", () => ({
  ...jest.requireActual<object>("@fluency-lab/shared"),
  PRACTICE_SOLVER_MODEL: "solver-under-test",
  PRACTICE_REVIEW_MODEL: "review-under-test",
  PRACTICE_WRITER_MODEL: "writer-under-test",
}));

const request = { system: "s", turns: [{ role: "user", text: "{}" }] } as const;

function setup(body: unknown) {
  const bodies: { model: string }[] = [];
  const fetchFn = jest.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
    bodies.push(JSON.parse(String(init?.body)));
    return new Response(
      JSON.stringify({
        type: "message",
        stop_reason: "end_turn",
        content: [{ type: "text", text: JSON.stringify(body) }],
        usage: { input_tokens: 1, output_tokens: 1 },
      }),
      { status: 200 },
    );
  });
  const ai = createClaudeAi({
    fetchFn: fetchFn as unknown as typeof fetch,
    readKey: async () => ({ ok: true, value: generatedSecret("api-key") }),
  });
  return { ai, bodies };
}

const exercise = {
  kind: "gap",
  rule: "r",
  prompt: "p ___",
  options: [],
  accepted: ["a"],
  explanation: "e",
  source: "",
};
const review = {
  singleAnswer: true,
  meaningKept: true,
  answerNotInPrompt: true,
  oneRealMistake: true,
  naturalEnglish: true,
  solverAnswerAccepted: true,
  passed: true,
  reason: "",
};

describe("the model of each call", () => {
  it("sends and reports the writer model for practiceExercise", async () => {
    const { ai, bodies } = setup(exercise);
    const outcome = await ai.practiceExercise({
      system: request.system,
      turns: [...request.turns],
    });
    expect(bodies[0].model).toBe("writer-under-test");
    expect(outcome.ok && outcome.value.model).toBe("writer-under-test");
  });

  it("sends and reports the solver model for solveExercise", async () => {
    const { ai, bodies } = setup({ answer: "a", alreadyCorrect: false });
    const outcome = await ai.solveExercise({ system: request.system, turns: [...request.turns] });
    expect(bodies[0].model).toBe("solver-under-test");
    expect(outcome.ok && outcome.value.model).toBe("solver-under-test");
  });

  it("sends and reports the review model for reviewExercise", async () => {
    const { ai, bodies } = setup(review);
    const outcome = await ai.reviewExercise({ system: request.system, turns: [...request.turns] });
    expect(bodies[0].model).toBe("review-under-test");
    expect(outcome.ok && outcome.value.model).toBe("review-under-test");
  });

  it("sends and reports the tutor model for reply and gradeAnswer", async () => {
    const reply = setup({ reply: "Hi", corrections: [], explanation: "", newWords: [] });
    const replied = await reply.ai.reply({ system: request.system, turns: [...request.turns] });
    expect(reply.bodies[0].model).toBe(TUTOR_MODEL);
    expect(replied.ok && replied.value.model).toBe(TUTOR_MODEL);
    const grade = setup({ flawed: false, correct: true, explanation: "" });
    const graded = await grade.ai.gradeAnswer({
      system: request.system,
      turns: [...request.turns],
    });
    expect(grade.bodies[0].model).toBe(TUTOR_MODEL);
    expect(graded.ok && graded.value.model).toBe(TUTOR_MODEL);
  });
});
