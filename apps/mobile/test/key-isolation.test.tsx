// apps/mobile/test/key-isolation.test.tsx
//
// Cross-cutting tests that the user's API key goes only to the provider endpoint.
//
// Tested:
// - The key is sent only to the provider endpoint, in x-api-key
// - The key never reaches the data port or any request to our API
// - The same holds for a question asked in a correction thread
// - The same holds for a practice round and the grading of a typed answer
// - The same holds for a study note made from a missed exercise
// - A 401 or a network error that echoes the key draws no key, cause line included
// - Nothing is logged
//   (that only the AI wiring reads the key is checked in scripts/test/key-reader.test.mjs)
//
// What is covered:
// - Normal case, edges
//
// Run with: pnpm exec jest apps/mobile/test/key-isolation.test.tsx
//
// SEE: apps/mobile/src/ai/index.ts

import { afterEach, beforeEach, describe, expect, it, jest } from "@jest/globals";
import { act, fireEvent, screen } from "@testing-library/react-native";

import { resetFakeAuth, fakeSession } from "./helpers/fake-auth";
import { resetFakeAi } from "./helpers/fake-ai";
import { fakeKeys, resetFakeKeys } from "./helpers/fake-keys";
import {
  apiKey,
  data,
  provider,
  providerGradeSuccess,
  providerNoteSuccess,
  providerRoundSuccess,
  providerSuccess,
  providerThreadSuccess,
  recorded,
} from "./helpers/isolation-wiring";
import { renderAppAt } from "./helpers/render-app";
import { setDev } from "./helpers/set-dev";

jest.mock("expo-font", () => ({ useFonts: jest.fn(() => [true, null]) }));
jest.mock("expo-splash-screen", () => ({
  preventAutoHideAsync: jest.fn(),
  hide: jest.fn(),
}));
jest.mock("@/data", () => ({
  data: jest.requireActual<typeof import("./helpers/isolation-wiring")>(
    "./helpers/isolation-wiring",
  ).data,
}));
jest.mock("@/ai", () => ({
  ai: jest.requireActual<typeof import("./helpers/isolation-wiring")>("./helpers/isolation-wiring")
    .ai,
}));
jest.mock("@/keys", () => ({
  keys: jest.requireActual<typeof import("./helpers/fake-keys")>("./helpers/fake-keys").fakeKeys,
}));
jest.mock("@/auth", () => {
  const fake = jest.requireActual<typeof import("./helpers/fake-auth")>("./helpers/fake-auth");
  return { auth: fake.fakeAuth, apple: fake.fakeApple };
});

const PROVIDER_ORIGIN = "https://api.anthropic.com";
const savedDev = __DEV__;
const logs = ["log", "info", "warn", "error", "debug"] as const;
const spies = logs.map((name) => jest.spyOn(console, name).mockImplementation(() => {}));
const dataMethods = Object.keys(data) as (keyof typeof data)[];
type CallSpy = { mock: { calls: unknown[][] }; mockClear(): void };
const dataSpies = dataMethods.map((name) => jest.spyOn(data, name) as unknown as CallSpy);

async function chatAndSend() {
  await renderAppAt("/chat", fakeSession());
  await fireEvent.changeText(screen.getByPlaceholderText("Write in English…"), "Hello");
  await fireEvent.press(screen.getByRole("button", { name: "Send", disabled: false }));
}

describe("the user's key", () => {
  beforeEach(() => {
    resetFakeAuth();
    resetFakeKeys();
    resetFakeAi();
    fakeKeys.hasApiKey.mockResolvedValue({ ok: true, value: true });
    fakeKeys.readApiKey.mockResolvedValue({ ok: true, value: apiKey });
    recorded.length = 0;
    provider.answer = providerSuccess;
    setDev(true);
    for (const spy of spies) spy.mockClear();
    for (const spy of dataSpies) spy.mockClear();
  });

  afterEach(() => {
    setDev(savedDev);
  });

  it("is sent only to the provider endpoint, in x-api-key", async () => {
    await chatAndSend();

    const toProvider = recorded.filter((entry) => entry.url.startsWith(PROVIDER_ORIGIN));
    const toApi = recorded.filter((entry) => entry.url.startsWith("http://api.test"));
    expect(toProvider).toHaveLength(1);
    expect(fakeKeys.readApiKey).toHaveBeenCalledTimes(1);
    expect(toApi.length).toBeGreaterThan(0);
    expect(recorded).toHaveLength(toProvider.length + toApi.length);

    expect(toProvider[0].headers["x-api-key"]).toBe(apiKey);
    expect(toProvider[0].url).not.toContain(apiKey);
    expect(toProvider[0].body).not.toContain(apiKey);
    for (const [name, value] of Object.entries(toProvider[0].headers)) {
      if (name !== "x-api-key") expect(value).not.toContain(apiKey);
    }

    for (const entry of toApi) {
      expect(entry.url).not.toContain(apiKey);
      expect(entry.body).not.toContain(apiKey);
      expect(Object.values(entry.headers).join("\n")).not.toContain(apiKey);
    }
  });

  it("never reaches the data port", async () => {
    await chatAndSend();

    const calls = dataSpies.flatMap((spy) => spy.mock.calls);
    expect(calls.length).toBeGreaterThan(0);
    expect(JSON.stringify(calls)).not.toContain(apiKey);
  });

  it("draws no key when a 401 echoes it", async () => {
    provider.answer = () =>
      new Response(
        JSON.stringify({
          type: "error",
          error: { type: "authentication_error", message: `invalid x-api-key ${apiKey}` },
        }),
        { status: 401 },
      );

    await chatAndSend();

    expect(
      screen.getByText("Your API key was not accepted. Update it to keep chatting."),
    ).toBeTruthy();
    expect(screen.getByText("HttpError (authentication_error)")).toBeTruthy();
    expect(JSON.stringify(screen.toJSON())).not.toContain(apiKey);
  });

  it("draws no key when a network error echoes it", async () => {
    provider.answer = () => {
      throw new TypeError(`Network request failed ${apiKey}`);
    };

    await chatAndSend();

    expect(
      screen.getByText("Could not reach the AI. Check your connection and try again."),
    ).toBeTruthy();
    expect(JSON.stringify(screen.toJSON())).not.toContain(apiKey);
  });

  it("is sent only to the provider endpoint when a question is asked in a thread", async () => {
    provider.answer = providerThreadSuccess;
    await renderAppAt({ pathname: "/thread", params: { message: "message-1" } }, fakeSession());
    await fireEvent.press(screen.getByRole("button", { name: "Why is it wrong?" }));
    await act(async () => {});

    const toProvider = recorded.filter((entry) => entry.url.startsWith(PROVIDER_ORIGIN));
    const toApi = recorded.filter((entry) => entry.url.startsWith("http://api.test"));
    expect(toProvider).toHaveLength(1);
    expect(toProvider[0].headers["x-api-key"]).toBe(apiKey);
    expect(toProvider[0].body).not.toContain(apiKey);
    expect(toApi.some((entry) => entry.url.endsWith("/thread") && entry.method === "POST")).toBe(
      true,
    );
    expect(recorded).toHaveLength(toProvider.length + toApi.length);
    for (const entry of toApi) {
      expect(entry.url).not.toContain(apiKey);
      expect(entry.body).not.toContain(apiKey);
      expect(Object.values(entry.headers).join("\n")).not.toContain(apiKey);
    }
    expect(JSON.stringify(dataSpies.flatMap((spy) => spy.mock.calls))).not.toContain(apiKey);
  });

  it("is sent only to the provider endpoint when a practice round and a grading are asked", async () => {
    let calls = 0;
    provider.answer = () => (calls++ === 0 ? providerRoundSuccess() : providerGradeSuccess());
    await renderAppAt(
      { pathname: "/practice-run", params: { focus: "mistakes", target: "5" } },
      fakeSession(),
    );
    await fireEvent.changeText(screen.getByLabelText("Your answer"), "I never was to Japan.");
    await fireEvent.press(screen.getByRole("button", { name: "Check" }));
    await act(async () => {});

    const toProvider = recorded.filter((entry) => entry.url.startsWith(PROVIDER_ORIGIN));
    const toApi = recorded.filter((entry) => entry.url.startsWith("http://api.test"));
    expect(toProvider).toHaveLength(2);
    for (const entry of toProvider) {
      expect(entry.headers["x-api-key"]).toBe(apiKey);
      expect(entry.url).not.toContain(apiKey);
      expect(entry.body).not.toContain(apiKey);
    }
    expect(toApi.some((entry) => entry.url.endsWith("/practice/runs"))).toBe(true);
    expect(recorded).toHaveLength(toProvider.length + toApi.length);
    for (const entry of toApi) {
      expect(entry.url).not.toContain(apiKey);
      expect(entry.body).not.toContain(apiKey);
      expect(Object.values(entry.headers).join("\n")).not.toContain(apiKey);
    }
    expect(JSON.stringify(dataSpies.flatMap((spy) => spy.mock.calls))).not.toContain(apiKey);
    expect(JSON.stringify(screen.toJSON())).not.toContain(apiKey);
  });

  it("sends the key only to the provider for a study note", async () => {
    const answers = [providerRoundSuccess, providerGradeSuccess, providerNoteSuccess];
    let calls = 0;
    provider.answer = () => (answers[calls++] ?? providerNoteSuccess)();
    await renderAppAt(
      { pathname: "/practice-run", params: { focus: "mistakes", target: "5" } },
      fakeSession(),
    );
    await fireEvent.changeText(screen.getByLabelText("Your answer"), "I never was to Japan.");
    await fireEvent.press(screen.getByRole("button", { name: "Check" }));
    await act(async () => {});
    await fireEvent.press(screen.getByRole("button", { name: "Make me a study note" }));
    await act(async () => {});

    const toProvider = recorded.filter((entry) => entry.url.startsWith(PROVIDER_ORIGIN));
    const toApi = recorded.filter((entry) => entry.url.startsWith("http://api.test"));
    expect(toProvider).toHaveLength(3);
    for (const entry of toProvider) {
      expect(entry.headers["x-api-key"]).toBe(apiKey);
      expect(entry.url).not.toContain(apiKey);
      expect(entry.body).not.toContain(apiKey);
    }
    expect(toApi.some((entry) => entry.url.endsWith("/notes") && entry.method === "POST")).toBe(
      true,
    );
    expect(recorded).toHaveLength(toProvider.length + toApi.length);
    for (const entry of toApi) {
      expect(entry.url).not.toContain(apiKey);
      expect(entry.body).not.toContain(apiKey);
      expect(Object.values(entry.headers).join("\n")).not.toContain(apiKey);
    }
    expect(JSON.stringify(dataSpies.flatMap((spy) => spy.mock.calls))).not.toContain(apiKey);
    expect(JSON.stringify(screen.toJSON())).not.toContain(apiKey);
  });

  it("logs nothing", async () => {
    await chatAndSend();
    await act(async () => {});

    for (const spy of spies) expect(spy).not.toHaveBeenCalled();
  });
});
