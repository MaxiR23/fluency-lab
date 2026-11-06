// apps/mobile/test/app/api-key.test.tsx
//
// Tests for the key step.
//
// Tested:
// - It draws Your AI with the provider, key and limit fields and no step label
// - It validates, saves the provider and limit, then the key, and goes back
// - The profile save and key save failures, and a save that ends after the user left, the busy state and Back
//
// What is covered:
// - Normal case, empty case, edges
//
// Run with: pnpm exec jest apps/mobile/test/app/api-key.test.tsx
//
// SEE: apps/mobile/src/app/api-key.tsx

import { beforeEach, describe, expect, it, jest } from "@jest/globals";
import { act, fireEvent, screen } from "@testing-library/react-native";
import { router } from "expo-router";

import { dataFailureMessage, keySaveFailureMessage } from "@/utils/data-message";
import { fakeSession, resetFakeAuth } from "../helpers/fake-auth";
import { completedProfile, fakeData, resetFakeData } from "../helpers/fake-data";
import { fakeKeys, resetFakeKeys } from "../helpers/fake-keys";
import { generatedSecret } from "../helpers/generated-secret";
import { renderAppAt } from "../helpers/render-app";

jest.mock("expo-font", () => ({ useFonts: jest.fn(() => [true, null]) }));
jest.mock("expo-splash-screen", () => ({
  preventAutoHideAsync: jest.fn(),
  hide: jest.fn(),
}));
jest.mock("@/data", () => ({
  data: jest.requireActual<typeof import("../helpers/fake-data")>("../helpers/fake-data").fakeData,
}));
jest.mock("@/keys", () => ({
  keys: jest.requireActual<typeof import("../helpers/fake-keys")>("../helpers/fake-keys").fakeKeys,
}));
jest.mock("@/auth", () => {
  const fake = jest.requireActual<typeof import("../helpers/fake-auth")>("../helpers/fake-auth");
  return { auth: fake.fakeAuth, apple: fake.fakeApple };
});

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

async function openKeyStep() {
  await renderAppAt("/chat", fakeSession());
  await fireEvent.press(screen.getByRole("button", { name: "Add API key" }));
}

describe("Key step", () => {
  beforeEach(() => {
    resetFakeAuth();
    resetFakeData();
    resetFakeKeys();
  });

  it("draws Your AI with the provider, key and limit fields and no step label", async () => {
    await openKeyStep();
    expect(screen.getByText("Your AI")).toBeTruthy();
    expect(screen.getByLabelText("Provider")).toBeTruthy();
    expect(screen.getByLabelText("API key")).toBeTruthy();
    expect(screen.getByLabelText("Monthly limit (USD)")).toBeTruthy();
    expect(screen.queryByText(/^Step /)).toBeNull();
  });

  it("shows the field errors and saves nothing when the key is empty", async () => {
    await openKeyStep();
    await fireEvent.press(screen.getByRole("button", { name: "Save" }));
    expect(screen.getByText("Enter your API key.")).toBeTruthy();
    expect(fakeKeys.saveApiKey).not.toHaveBeenCalled();
    expect(fakeData.updateProfile).not.toHaveBeenCalled();
    expect(screen).toHavePathname("/api-key");
  });

  it("saves the provider and limit, then the trimmed key, and goes back to Chat", async () => {
    const key = generatedSecret("api-key");
    fakeData.updateProfile.mockResolvedValue({ ok: true, value: completedProfile() });
    await openKeyStep();
    await fireEvent.press(screen.getByRole("radio", { name: "OpenAI" }));
    await fireEvent.changeText(screen.getByLabelText("API key"), `  ${key}  `);
    await fireEvent.changeText(screen.getByLabelText("Monthly limit (USD)"), "25");
    await fireEvent.press(screen.getByRole("button", { name: "Save" }));
    expect(fakeKeys.saveApiKey).toHaveBeenCalledWith(key);
    expect(fakeData.updateProfile).toHaveBeenCalledWith({
      provider: "openai",
      monthlyLimitUsd: 25,
    });
    const saveOrder = fakeKeys.saveApiKey.mock.invocationCallOrder[0] ?? 0;
    const profileOrder = fakeData.updateProfile.mock.invocationCallOrder[0] ?? 0;
    expect(profileOrder).toBeLessThan(saveOrder);
    expect(screen).toHavePathname("/chat");
  });

  it("shows the profile failure, saves no key and stays on the key step", async () => {
    fakeData.updateProfile.mockResolvedValue({ ok: false, failure: "network" });
    await openKeyStep();
    await fireEvent.changeText(screen.getByLabelText("API key"), generatedSecret("api-key"));
    await fireEvent.press(screen.getByRole("button", { name: "Save" }));
    expect(screen.getByText(dataFailureMessage("network"))).toBeTruthy();
    expect(fakeKeys.saveApiKey).not.toHaveBeenCalled();
    expect(screen).toHavePathname("/api-key");
  });

  it("shows the key failure after the profile saved and Chat stays without a key", async () => {
    fakeData.updateProfile.mockResolvedValue({ ok: true, value: completedProfile() });
    fakeKeys.saveApiKey.mockResolvedValue({ ok: false, failure: "not_saved" });
    await openKeyStep();
    await fireEvent.changeText(screen.getByLabelText("API key"), generatedSecret("api-key"));
    await fireEvent.press(screen.getByRole("button", { name: "Save" }));
    expect(screen.getByText(keySaveFailureMessage)).toBeTruthy();
    expect(screen).toHavePathname("/api-key");
    await fireEvent.press(screen.getByRole("link", { name: "Back" }));
    expect(screen.getByText("Connect your AI to start")).toBeTruthy();
  });

  it("does not go back again when the user already left the key step during the save", async () => {
    const pending = deferred<Awaited<ReturnType<typeof fakeData.updateProfile>>>();
    fakeData.updateProfile.mockReturnValue(pending.promise);
    await openKeyStep();
    await fireEvent.changeText(screen.getByLabelText("API key"), generatedSecret("api-key"));
    await fireEvent.press(screen.getByRole("button", { name: "Save" }));
    await act(async () => router.back());
    expect(screen).toHavePathname("/chat");
    await act(async () => pending.resolve({ ok: true, value: completedProfile() }));
    expect(screen).toHavePathname("/chat");
  });

  it("shows Save busy and Back disabled while saving", async () => {
    const pending = deferred<Awaited<ReturnType<typeof fakeData.updateProfile>>>();
    fakeData.updateProfile.mockReturnValue(pending.promise);
    await openKeyStep();
    await fireEvent.changeText(screen.getByLabelText("API key"), generatedSecret("api-key"));
    await fireEvent.press(screen.getByRole("button", { name: "Save" }));
    expect(screen.getByRole("button", { name: "Save", busy: true, disabled: true })).toBeTruthy();
    expect(screen.getByText("Back").props.disabled).toBe(true);
    await act(async () => pending.resolve({ ok: false, failure: "network" }));
  });

  it("goes back to Chat on Back", async () => {
    await openKeyStep();
    await fireEvent.press(screen.getByRole("link", { name: "Back" }));
    expect(screen).toHavePathname("/chat");
  });
});
