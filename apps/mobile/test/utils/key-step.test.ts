// apps/mobile/test/utils/key-step.test.ts
//
// Tests for the key step pure functions.
//
// Tested:
// - keyStepStart reads the route params the key step starts on
// - removeKeyButtons and the remove prompt
//
// What is covered:
// - Normal case, empty case, edges
//
// Run with: pnpm exec jest apps/mobile/test/utils/key-step.test.ts
//
// SEE: apps/mobile/src/utils/key-step.ts

import { describe, expect, it, jest } from "@jest/globals";

import { keyStepStart, removeKeyButtons, removeKeyPrompt } from "@/utils/key-step";

describe("keyStepStart", () => {
  it("starts on the given provider and limit and is removable", () => {
    expect(keyStepStart({ provider: "openai", limit: "25.5", removable: "1" })).toEqual({
      provider: "openai",
      monthlyLimit: "25.5",
      removable: true,
    });
  });

  it("starts on claude and 10 and not removable with no params", () => {
    expect(keyStepStart({})).toEqual({ provider: "claude", monthlyLimit: "10", removable: false });
  });

  it("ignores an unknown provider and a bad limit", () => {
    expect(keyStepStart({ provider: "other", limit: "0", removable: "1" })).toEqual({
      provider: "claude",
      monthlyLimit: "10",
      removable: true,
    });
    expect(keyStepStart({ limit: "abc" }).monthlyLimit).toBe("10");
    expect(keyStepStart({ limit: "10000.01" }).monthlyLimit).toBe("10");
  });

  it("is removable only for 1", () => {
    expect(keyStepStart({ removable: "0" }).removable).toBe(false);
    expect(keyStepStart({ removable: "true" }).removable).toBe(false);
  });

  it("reads the first value of an array param", () => {
    expect(keyStepStart({ provider: ["openai", "claude"], removable: ["1"] })).toMatchObject({
      provider: "openai",
      removable: true,
    });
    expect(keyStepStart({ provider: [] }).provider).toBe("claude");
  });
});

describe("removeKeyPrompt and removeKeyButtons", () => {
  it("explains what removing does", () => {
    expect(removeKeyPrompt).toEqual({
      title: "Remove your API key?",
      message: "It is deleted from this device. Chat needs a key to reply.",
    });
  });

  it("offers Cancel then Remove, Remove destructive and calling its callback", () => {
    const onRemove = jest.fn();
    const buttons = removeKeyButtons(onRemove);
    expect(buttons.map((button) => [button.text, button.style])).toEqual([
      ["Cancel", "cancel"],
      ["Remove", "destructive"],
    ]);
    buttons[1]?.onPress?.();
    expect(onRemove).toHaveBeenCalledTimes(1);
  });
});
