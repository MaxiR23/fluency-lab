// apps/mobile/test/app/chat.test.tsx
//
// Tests for the Chat screen.
//
// Tested:
// - Loading, no key, ready (empty conversation) and the key and profile read errors
// - The header: topic title or Free chat, the provider line and Back
// - The no key state: card, locked input and Send, Add API key opens the key step
// - The ready state: Send follows the draft, the composer sits in a KeyboardAvoidingView
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
import { act, fireEvent, screen, within } from "@testing-library/react-native";

import { dataFailureMessage, keyReadFailureMessage } from "@/utils/data-message";
import { fakeSession, resetFakeAuth } from "../helpers/fake-auth";
import { completedProfile, fakeData, profileWith, resetFakeData } from "../helpers/fake-data";
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

// INFO: jest renders no keyboard, so the wiring is proved through the props this spy records.
const keyboardAvoidingProps: { behavior?: string }[] = [];
jest.mock("react-native/Libraries/Components/Keyboard/KeyboardAvoidingView", () => {
  const { View } = jest.requireActual<typeof import("react-native")>("react-native");
  return {
    __esModule: true,
    default: ({ behavior, children, ...rest }: { behavior?: string; children?: unknown }) => {
      keyboardAvoidingProps.push({ behavior });
      return <View {...rest}>{children as never}</View>;
    },
  };
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
    keyboardAvoidingProps.length = 0;
  });

  function withKey(provider: "claude" | "openai" | null = "claude") {
    fakeKeys.hasApiKey.mockResolvedValue({ ok: true, value: true });
    fakeData.getProfile.mockResolvedValue({
      ok: true,
      value: profileWith({ provider, onboardingCompletedAt: "2026-11-05T10:00:00Z" }),
    });
  }

  it("draws the loading state while the key is read", async () => {
    const pending = deferred<Awaited<ReturnType<typeof fakeKeys.hasApiKey>>>();
    fakeKeys.hasApiKey.mockReturnValue(pending.promise);
    await renderAppAt("/chat", fakeSession());
    expect(screen.getByTestId("chat-loading")).toBeTruthy();
    await act(async () => pending.resolve({ ok: true, value: false }));
    expect(screen.queryByTestId("chat-loading")).toBeNull();
  });

  it("draws the no-key state: header, card, locked input and Send", async () => {
    await renderAppAt("/chat", fakeSession());
    expect(screen.getByRole("header", { name: "Free chat" })).toBeTruthy();
    expect(screen.getByText("No AI connected")).toBeTruthy();
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

  it("draws the empty conversation with the provider when a key is saved", async () => {
    withKey("claude");
    await renderAppAt("/chat", fakeSession());
    expect(screen.getByText("Claude")).toBeTruthy();
    expect(screen.getByTestId("message-list")).toBeTruthy();
    expect(screen.queryByText("New word")).toBeNull();
    expect(screen.getByPlaceholderText("Write in English\u2026")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Send", disabled: true })).toBeTruthy();
    expect(screen.queryByText("Connect your AI to start")).toBeNull();
  });

  it("draws the composer inside a keyboard avoiding view with padding", async () => {
    withKey();
    await renderAppAt("/chat", fakeSession());
    expect(keyboardAvoidingProps).toEqual([{ behavior: "padding" }]);
    const view = screen.getByTestId("chat-keyboard-view");
    expect(within(view).getByPlaceholderText("Write in English\u2026")).toBeTruthy();
  });

  it("enables Send after typing and disables it again when cleared", async () => {
    withKey();
    await renderAppAt("/chat", fakeSession());
    const input = screen.getByPlaceholderText("Write in English\u2026");
    await fireEvent.changeText(input, "Hello");
    expect(screen.getByRole("button", { name: "Send", disabled: false })).toBeTruthy();
    await fireEvent.changeText(input, "");
    expect(screen.getByRole("button", { name: "Send", disabled: true })).toBeTruthy();
  });

  it("draws the topic title passed by the caller", async () => {
    withKey();
    await renderAppAt({ pathname: "/chat", params: { topic: "Travel plans" } }, fakeSession());
    expect(screen.getByRole("header", { name: "Travel plans" })).toBeTruthy();
  });

  it("draws the key read failure and reads again on Try again", async () => {
    fakeKeys.hasApiKey.mockResolvedValueOnce({ ok: false, failure: "not_read" });
    await renderAppAt("/chat", fakeSession());
    expect(screen.getByText(keyReadFailureMessage)).toBeTruthy();
    withKey();
    await fireEvent.press(screen.getByRole("button", { name: "Try again" }));
    expect(screen.getByText("Claude")).toBeTruthy();
    expect(fakeKeys.hasApiKey).toHaveBeenCalledTimes(2);
  });

  it("draws the profile failure when a key is saved and the server cannot be reached", async () => {
    fakeKeys.hasApiKey.mockResolvedValue({ ok: true, value: true });
    fakeData.getProfile.mockResolvedValue({ ok: false, failure: "network" });
    await renderAppAt("/chat", fakeSession());
    expect(screen.getByText(dataFailureMessage("network"))).toBeTruthy();
  });

  it("goes back from Back to Home", async () => {
    await renderAppAt("/chat", fakeSession());
    await fireEvent.press(screen.getByRole("button", { name: "Back to Home" }));
    expect(screen).toHavePathname("/");
  });

  it("shows the provider after a key is saved in the key step and it goes back", async () => {
    await renderAppAt("/chat", fakeSession());
    await fireEvent.press(screen.getByRole("button", { name: "Add API key" }));
    withKey("openai");
    fakeData.updateProfile.mockResolvedValue({ ok: true, value: completedProfile() });
    await fireEvent.changeText(screen.getByLabelText("API key"), generatedSecret("api-key"));
    await fireEvent.press(screen.getByRole("button", { name: "Save" }));
    expect(screen).toHavePathname("/chat");
    expect(screen.getByText("OpenAI")).toBeTruthy();
  });

  it("lands on Login when signed out at Chat", async () => {
    await renderApp("/chat", null);
    expect(screen).toHavePathname("/sign-in");
    expect(screen.queryByText("Connect your AI to start")).toBeNull();
  });
});
