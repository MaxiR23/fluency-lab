// apps/mobile/test/app/chat.test.tsx
//
// Tests for the Chat screen.
//
// Tested:
// - Loading, no key, with a key and key read error states
// - The no key state: input and Send disabled, Add API key opens the key step
// - The state updates when the key step goes back to Chat
// - Signed out users cannot reach Chat
//
// What is covered:
// - Normal case, empty case, edges
//
// Run with: pnpm exec jest apps/mobile/test/app/chat.test.tsx
//
// SEE: apps/mobile/src/app/chat.tsx

import { beforeEach, describe, expect, it, jest } from "@jest/globals";
import { act, fireEvent, screen } from "@testing-library/react-native";

import { keyReadFailureMessage } from "@/utils/data-message";
import { fakeSession, resetFakeAuth } from "../helpers/fake-auth";
import { completedProfile, fakeData, resetFakeData } from "../helpers/fake-data";
import { fakeKeys, resetFakeKeys } from "../helpers/fake-keys";
import { renderApp, renderAppAt } from "../helpers/render-app";
import { generatedSecret } from "../helpers/generated-secret";

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

describe("Chat", () => {
  beforeEach(() => {
    resetFakeAuth();
    resetFakeData();
    resetFakeKeys();
  });

  it("draws the loading state while the key is read", async () => {
    const pending = deferred<Awaited<ReturnType<typeof fakeKeys.hasApiKey>>>();
    fakeKeys.hasApiKey.mockReturnValue(pending.promise);
    await renderAppAt("/chat", fakeSession());
    expect(screen.getByTestId("chat-loading")).toBeTruthy();
    await act(async () => pending.resolve({ ok: true, value: false }));
    expect(screen.queryByTestId("chat-loading")).toBeNull();
  });

  it("draws the no-key state with the input and Send disabled", async () => {
    await renderAppAt("/chat", fakeSession());
    expect(screen.getByText("Connect your AI to start")).toBeTruthy();
    expect(
      screen.getByText("Add your Claude or OpenAI key. It stays only on this device."),
    ).toBeTruthy();
    expect(screen.getByPlaceholderText("Add a key to start chatting").props.editable).toBe(false);
    expect(screen.getByRole("button", { name: "Send", disabled: true })).toBeTruthy();
  });

  it("opens the key step from Add API key", async () => {
    await renderAppAt("/chat", fakeSession());
    await fireEvent.press(screen.getByRole("button", { name: "Add API key" }));
    expect(screen).toHavePathname("/api-key");
  });

  it("draws the placeholder when a key is saved", async () => {
    fakeKeys.hasApiKey.mockResolvedValue({ ok: true, value: true });
    await renderAppAt("/chat", fakeSession());
    expect(screen.getByText("Chat")).toBeTruthy();
    expect(screen.getByText("Chat is coming soon.")).toBeTruthy();
    expect(screen.queryByText("Connect your AI to start")).toBeNull();
  });

  it("draws the read failure and reads again on Try again", async () => {
    fakeKeys.hasApiKey.mockResolvedValueOnce({ ok: false, failure: "not_read" });
    await renderAppAt("/chat", fakeSession());
    expect(screen.getByText(keyReadFailureMessage)).toBeTruthy();
    fakeKeys.hasApiKey.mockResolvedValue({ ok: true, value: true });
    await fireEvent.press(screen.getByRole("button", { name: "Try again" }));
    expect(screen.getByText("Chat is coming soon.")).toBeTruthy();
    expect(fakeKeys.hasApiKey).toHaveBeenCalledTimes(2);
  });

  it("shows the placeholder after a key is saved in the key step and it goes back", async () => {
    await renderAppAt("/chat", fakeSession());
    await fireEvent.press(screen.getByRole("button", { name: "Add API key" }));
    fakeKeys.hasApiKey.mockResolvedValue({ ok: true, value: true });
    fakeData.updateProfile.mockResolvedValue({ ok: true, value: completedProfile() });
    await fireEvent.changeText(screen.getByLabelText("API key"), generatedSecret("api-key"));
    await fireEvent.press(screen.getByRole("button", { name: "Save" }));
    expect(screen).toHavePathname("/chat");
    expect(screen.getByText("Chat is coming soon.")).toBeTruthy();
  });

  it("lands on Login when signed out at Chat", async () => {
    await renderApp("/chat", null);
    expect(screen).toHavePathname("/sign-in");
    expect(screen.queryByText("Connect your AI to start")).toBeNull();
  });
});
