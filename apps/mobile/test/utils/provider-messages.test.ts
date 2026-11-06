// apps/mobile/test/utils/provider-messages.test.ts
//
// Tests for the history sent to the AI provider.
//
// Tested:
// - providerMessages maps the saved turns to provider messages
//
// What is covered:
// - Normal case, empty case, edges
//
// Run with: pnpm exec jest apps/mobile/test/utils/provider-messages.test.ts
//
// SEE: apps/mobile/src/utils/provider-messages.ts

import { describe, expect, it } from "@jest/globals";

import { providerMessages } from "@/utils/provider-messages";

describe("providerMessages", () => {
  it("maps tutor turns to assistant", () => {
    expect(
      providerMessages([
        { role: "user", text: "Hi" },
        { role: "tutor", text: "Hello" },
        { role: "user", text: "Bye" },
      ]),
    ).toEqual([
      { role: "user", content: "Hi" },
      { role: "assistant", content: "Hello" },
      { role: "user", content: "Bye" },
    ]);
  });

  it("returns no messages for no turns", () => {
    expect(providerMessages([])).toEqual([]);
  });

  it("returns no messages when there is only a tutor opening", () => {
    expect(
      providerMessages([{ role: "tutor", text: "Hi! What would you like to talk about?" }]),
    ).toEqual([]);
  });

  it("drops the opening before the first user turn", () => {
    expect(
      providerMessages([
        { role: "tutor", text: "Opening" },
        { role: "user", text: "Hi" },
      ]),
    ).toEqual([{ role: "user", content: "Hi" }]);
  });

  it("merges two user turns in a row", () => {
    expect(
      providerMessages([
        { role: "user", text: "One" },
        { role: "user", text: "Two" },
      ]),
    ).toEqual([{ role: "user", content: "One\n\nTwo" }]);
  });

  it("merges two tutor turns in a row", () => {
    expect(
      providerMessages([
        { role: "user", text: "Hi" },
        { role: "tutor", text: "A" },
        { role: "tutor", text: "B" },
        { role: "user", text: "C" },
      ]),
    ).toEqual([
      { role: "user", content: "Hi" },
      { role: "assistant", content: "A\n\nB" },
      { role: "user", content: "C" },
    ]);
  });

  it("ends with the user's turn when the input does", () => {
    const messages = providerMessages([
      { role: "tutor", text: "Opening" },
      { role: "user", text: "Hi" },
      { role: "tutor", text: "Hello" },
      { role: "user", text: "Last" },
    ]);
    expect(messages.at(-1)).toEqual({ role: "user", content: "Last" });
  });
});
