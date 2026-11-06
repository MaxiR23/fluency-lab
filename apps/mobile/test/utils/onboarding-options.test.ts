// apps/mobile/test/utils/onboarding-options.test.ts
//
// Tests for the options and texts of the onboarding steps.
//
// Tested:
// - Levels, goals and providers follow the shared contract order
// - The texts of the issue, the default limit and the step titles
//
// What is covered:
// - Normal case, edges
//
// Run with: pnpm exec jest apps/mobile/test/utils/onboarding-options.test.ts
//
// SEE: apps/mobile/src/utils/onboarding-options.ts

import { describe, expect, it } from "@jest/globals";
import { GOALS, LEVELS, PROVIDERS } from "@fluency-lab/shared";

import {
  apiKeyNote,
  DEFAULT_MONTHLY_LIMIT,
  goalOptions,
  levelOptions,
  monthlyLimitNote,
  ONBOARDING_STEPS,
  providerOptions,
  stepTitles,
} from "@/utils/onboarding-options";

describe("onboarding options", () => {
  it("lists the three levels in the contract order with the issue's descriptions", () => {
    expect(levelOptions.map((option) => option.id)).toEqual([...LEVELS]);
    expect(levelOptions.map((option) => [option.label, option.description])).toEqual([
      ["Beginner", "I can write short, simple sentences."],
      ["Intermediate", "I can talk about my day, but I make mistakes."],
      ["Advanced", "I write with ease and want to sound natural."],
    ]);
  });

  it("lists the four goals with Everyday conversation for conversation", () => {
    expect(goalOptions.map((option) => option.id)).toEqual([...GOALS]);
    expect(goalOptions.map((option) => option.label)).toEqual([
      "Work",
      "Travel",
      "Exams",
      "Everyday conversation",
    ]);
  });

  it("lists Claude then OpenAI in the contract order", () => {
    expect(providerOptions.map((option) => option.id)).toEqual([...PROVIDERS]);
    expect(providerOptions.map((option) => option.label)).toEqual(["Claude", "OpenAI"]);
  });

  it("defaults the monthly limit to 10", () => {
    expect(DEFAULT_MONTHLY_LIMIT).toBe("10");
  });

  it("holds the notes and the four step titles", () => {
    expect(apiKeyNote).toBe("Stored only on this device.");
    expect(monthlyLimitNote).toBe(
      "We'll warn you when you reach it. For a hard cap, also set a spend limit in your provider's console.",
    );
    expect(ONBOARDING_STEPS).toBe(4);
    expect(stepTitles).toEqual(["Level", "Goal", "Topics", "Your AI"]);
  });
});
