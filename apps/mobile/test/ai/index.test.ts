// apps/mobile/test/ai/index.test.ts
//
// Tests for the wiring of the AI port.
//
// Tested:
// - ai.reply reads the key once from the key port and sends it only to the provider endpoint
//
// What is covered:
// - Normal case
//
// Run with: pnpm exec jest apps/mobile/test/ai/index.test.ts
//
// SEE: apps/mobile/src/ai/index.ts

import { beforeEach, describe, expect, it, jest } from "@jest/globals";

import { ai } from "@/ai";
import { fakeKeys, resetFakeKeys } from "../helpers/fake-keys";
import { generatedSecret } from "../helpers/generated-secret";

jest.mock("@/keys", () => ({
  keys: jest.requireActual<typeof import("../helpers/fake-keys")>("../helpers/fake-keys").fakeKeys,
}));

describe("ai", () => {
  beforeEach(() => {
    resetFakeKeys();
  });

  it("reads the key once and fetches only the endpoint, with the key in x-api-key", async () => {
    const key = generatedSecret("api-key");
    fakeKeys.readApiKey.mockResolvedValue({ ok: true, value: key });
    const fetchSpy = jest.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          stop_reason: "end_turn",
          content: [
            {
              type: "text",
              text: JSON.stringify({ reply: "Hi", corrections: [], explanation: "", newWords: [] }),
            },
          ],
          usage: { input_tokens: 1, output_tokens: 1 },
        }),
        { status: 200 },
      ),
    );
    const outcome = await ai.reply({ system: "s", turns: [{ role: "user", text: "Hello" }] });

    expect(outcome.ok).toBe(true);
    expect(fakeKeys.readApiKey).toHaveBeenCalledTimes(1);
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const [url, init] = fetchSpy.mock.calls[0];
    expect(url).toBe("https://api.anthropic.com/v1/messages");
    expect(new Headers(init?.headers).get("x-api-key")).toBe(key);
    fetchSpy.mockRestore();
  });
});
