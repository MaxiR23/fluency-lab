// apps/mobile/test/utils/onboarding-form.test.ts
//
// Tests for the onboarding form: the reducer, the step rules, the labels,
// the monthly limit, the AI step validation and the profile update builder.
//
// Tested:
// - The reducer events and the step rules
// - The monthly limit parsing and the AI step errors
// - The update sent for Finish and for Skip, and that it never carries the key
//
// What is covered:
// - Normal case, empty case, edges
//
// Run with: pnpm exec jest apps/mobile/test/utils/onboarding-form.test.ts
//
// SEE: apps/mobile/src/utils/onboarding-form.ts

import { describe, expect, it } from "@jest/globals";
import { profileUpdateSchema, type TopicId } from "@fluency-lab/shared";

import {
  canContinue,
  initialOnboardingForm,
  normalizeApiKey,
  onboardingFormReducer,
  onboardingUpdate,
  parseMonthlyLimit,
  selectedCountLabel,
  showsBack,
  stepLabel,
  toggle,
  validateAiStep,
  type OnboardingDraft,
  type OnboardingForm,
} from "@/utils/onboarding-form";
import { generatedSecret } from "../helpers/generated-secret";

const threeTopics: TopicId[] = ["food", "music", "books"];

function formAt(
  step: OnboardingForm["step"],
  draft: Partial<OnboardingDraft> = {},
): OnboardingForm {
  return { step, draft: { ...initialOnboardingForm.draft, ...draft } };
}

describe("onboardingFormReducer", () => {
  it("starts at step 1 with nothing selected, Claude and a limit of 10", () => {
    expect(initialOnboardingForm).toEqual({
      step: 1,
      draft: {
        level: null,
        goals: [],
        topics: [],
        provider: "claude",
        apiKey: "",
        monthlyLimit: "10",
      },
    });
  });

  it("replaces the level when another one is picked", () => {
    let form = onboardingFormReducer(initialOnboardingForm, {
      type: "level_picked",
      level: "beginner",
    });
    form = onboardingFormReducer(form, { type: "level_picked", level: "advanced" });
    expect(form.draft.level).toBe("advanced");
  });

  it("adds a goal and removes it on a second toggle", () => {
    let form = onboardingFormReducer(initialOnboardingForm, { type: "goal_toggled", goal: "work" });
    form = onboardingFormReducer(form, { type: "goal_toggled", goal: "travel" });
    expect(form.draft.goals).toEqual(["work", "travel"]);
    form = onboardingFormReducer(form, { type: "goal_toggled", goal: "work" });
    expect(form.draft.goals).toEqual(["travel"]);
  });

  it("adds topics in the order picked", () => {
    let form = initialOnboardingForm;
    for (const topic of threeTopics) {
      form = onboardingFormReducer(form, { type: "topic_toggled", topic });
    }
    expect(form.draft.topics).toEqual(threeTopics);
  });

  it("picks the provider", () => {
    const form = onboardingFormReducer(initialOnboardingForm, {
      type: "provider_picked",
      provider: "openai",
    });
    expect(form.draft.provider).toBe("openai");
  });

  it("stores the key and the limit as typed", () => {
    let form = onboardingFormReducer(initialOnboardingForm, {
      type: "api_key_changed",
      apiKey: " abc ",
    });
    form = onboardingFormReducer(form, { type: "monthly_limit_changed", monthlyLimit: "12.5" });
    expect(form.draft.apiKey).toBe(" abc ");
    expect(form.draft.monthlyLimit).toBe("12.5");
  });

  it("moves to the next step when the rule holds", () => {
    const form = onboardingFormReducer(formAt(1, { level: "beginner" }), { type: "continued" });
    expect(form.step).toBe(2);
  });

  it("keeps the draft when going back", () => {
    const start = formAt(3, { level: "beginner", goals: ["work"] });
    const form = onboardingFormReducer(start, { type: "went_back" });
    expect(form).toEqual({ step: 2, draft: start.draft });
  });

  it("does not continue from step 1 with no level", () => {
    expect(onboardingFormReducer(initialOnboardingForm, { type: "continued" })).toBe(
      initialOnboardingForm,
    );
  });

  it("does not continue from step 2 with no goal", () => {
    const start = formAt(2, { level: "beginner" });
    expect(onboardingFormReducer(start, { type: "continued" })).toBe(start);
  });

  it("does not continue from step 3 with two topics", () => {
    const start = formAt(3, { topics: ["food", "music"] });
    expect(onboardingFormReducer(start, { type: "continued" })).toBe(start);
  });

  it("continues from step 3 with exactly three topics", () => {
    const form = onboardingFormReducer(formAt(3, { topics: threeTopics }), { type: "continued" });
    expect(form.step).toBe(4);
  });

  it("does not go back from step 1", () => {
    expect(onboardingFormReducer(initialOnboardingForm, { type: "went_back" })).toBe(
      initialOnboardingForm,
    );
  });

  it("does not go past step 4", () => {
    const start = formAt(4);
    expect(onboardingFormReducer(start, { type: "continued" })).toBe(start);
  });
});

describe("step helpers", () => {
  it("toggles an item in and out of a list", () => {
    expect(toggle(["a"], "b")).toEqual(["a", "b"]);
    expect(toggle(["a", "b"], "a")).toEqual(["b"]);
    expect(toggle<string>([], "a")).toEqual(["a"]);
  });

  it("can continue from step 4 whatever the draft", () => {
    expect(canContinue(4, initialOnboardingForm.draft)).toBe(true);
  });

  it("shows Back from step 2 only", () => {
    expect(([1, 2, 3, 4] as const).map(showsBack)).toEqual([false, true, true, true]);
  });

  it("labels the step as Step N of 4", () => {
    expect(stepLabel(1)).toBe("Step 1 of 4");
    expect(stepLabel(4)).toBe("Step 4 of 4");
  });

  it("labels the counter 0 selected, 1 selected and 3 selected", () => {
    expect([0, 1, 3].map(selectedCountLabel)).toEqual(["0 selected", "1 selected", "3 selected"]);
  });
});

describe("parseMonthlyLimit", () => {
  it("parses 10", () => {
    expect(parseMonthlyLimit("10")).toBe(10);
  });

  it("parses 10.5 and 10.25", () => {
    expect(parseMonthlyLimit("10.5")).toBe(10.5);
    expect(parseMonthlyLimit("10.25")).toBe(10.25);
  });

  it("rejects an empty text", () => {
    expect(parseMonthlyLimit("")).toBeNull();
    expect(parseMonthlyLimit("   ")).toBeNull();
  });

  it("rejects 0", () => {
    expect(parseMonthlyLimit("0")).toBeNull();
    expect(parseMonthlyLimit("0.00")).toBeNull();
  });

  it("accepts 0.01", () => {
    expect(parseMonthlyLimit("0.01")).toBe(0.01);
  });

  it("accepts 10000", () => {
    expect(parseMonthlyLimit("10000")).toBe(10000);
  });

  it("rejects 10000.01", () => {
    expect(parseMonthlyLimit("10000.01")).toBeNull();
  });

  it("rejects three decimals", () => {
    expect(parseMonthlyLimit("1.234")).toBeNull();
  });

  it("rejects a negative or non-numeric text", () => {
    expect(parseMonthlyLimit("-5")).toBeNull();
    expect(parseMonthlyLimit("abc")).toBeNull();
    expect(parseMonthlyLimit("1e3")).toBeNull();
    expect(parseMonthlyLimit("1,5")).toBeNull();
  });

  it("trims spaces", () => {
    expect(parseMonthlyLimit(" 20 ")).toBe(20);
  });
});

describe("validateAiStep", () => {
  const apiKey = generatedSecret("api-key");

  it("returns no errors for a key and a valid limit", () => {
    expect(validateAiStep({ apiKey, monthlyLimit: "10" })).toEqual({});
  });

  it("asks for the key when it is empty or only spaces", () => {
    const message = "Enter your API key, or skip for now.";
    expect(validateAiStep({ apiKey: "", monthlyLimit: "10" })).toEqual({ apiKey: message });
    expect(validateAiStep({ apiKey: "   ", monthlyLimit: "10" })).toEqual({ apiKey: message });
  });

  it("asks for an amount when the limit is empty", () => {
    expect(validateAiStep({ apiKey, monthlyLimit: " " })).toEqual({
      monthlyLimit: "Enter an amount in USD.",
    });
  });

  it("rejects a limit out of range", () => {
    expect(validateAiStep({ apiKey, monthlyLimit: "0" })).toEqual({
      monthlyLimit: "Enter an amount between 0.01 and 10000, with at most two decimals.",
    });
    expect(validateAiStep({ apiKey, monthlyLimit: "20000" })).toHaveProperty("monthlyLimit");
  });
});

describe("onboardingUpdate", () => {
  const apiKey = generatedSecret("api-key");
  const draft: OnboardingDraft = {
    level: "intermediate",
    goals: ["work", "exams"],
    topics: threeTopics,
    provider: "openai",
    apiKey,
    monthlyLimit: "25.5",
  };

  it("builds the finish update with level, goals, topics, provider, limit and completion", () => {
    expect(onboardingUpdate(draft, "finish")).toEqual({
      level: "intermediate",
      goals: ["work", "exams"],
      topics: threeTopics,
      provider: "openai",
      monthlyLimitUsd: 25.5,
      onboardingCompleted: true,
    });
  });

  it("builds the skip update without provider, limit or key", () => {
    expect(onboardingUpdate(draft, "skip")).toEqual({
      level: "intermediate",
      goals: ["work", "exams"],
      topics: threeTopics,
      onboardingCompleted: true,
    });
  });

  it("never carries the API key", () => {
    for (const mode of ["finish", "skip"] as const) {
      const update = onboardingUpdate(draft, mode);
      expect(JSON.stringify(update)).not.toContain(apiKey);
      expect(Object.keys(update)).not.toContain("apiKey");
    }
    expect(Object.keys(onboardingUpdate(draft, "finish")).sort()).toEqual(
      ["goals", "level", "monthlyLimitUsd", "onboardingCompleted", "provider", "topics"].sort(),
    );
  });

  it("passes profileUpdateSchema for both modes", () => {
    expect(profileUpdateSchema.safeParse(onboardingUpdate(draft, "finish")).success).toBe(true);
    expect(profileUpdateSchema.safeParse(onboardingUpdate(draft, "skip")).success).toBe(true);
  });

  it("leaves the level out when there is none", () => {
    const update = onboardingUpdate({ ...draft, level: null }, "skip");
    expect(update).toEqual({
      goals: ["work", "exams"],
      topics: threeTopics,
      onboardingCompleted: true,
    });
  });
});

describe("normalizeApiKey", () => {
  it("trims the key", () => {
    expect(normalizeApiKey("  abc  ")).toBe("abc");
  });
});
