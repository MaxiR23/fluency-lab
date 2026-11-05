// apps/mobile/test/app/reset-password.test.tsx
//
// Tests for the second step of the password reset: entering the code.
//
// Tested:
// - Its texts, and the case with no email in the route
// - Validation, the request through the session provider and its busy state
// - Each failed step: its message, and what the screen offers next
// - The guard does not move while the confirmation runs
//
// What is covered:
// - Normal case, empty case, edges
//
// Run with: pnpm exec jest apps/mobile/test/app/reset-password.test.tsx
//
// SEE: apps/mobile/src/app/reset-password.tsx

import { beforeEach, describe, expect, it, jest } from "@jest/globals";
import { act, fireEvent, screen } from "@testing-library/react-native";
import { router } from "expo-router";

import type { PasswordResetOutcome } from "@/auth/auth-port";
import {
  authFailureMessage,
  missingResetEmailMessage,
  resetCodeSentMessage,
} from "@/utils/auth-message";
import { emitSession, fakeAuth, fakeSession, resetFakeAuth } from "../helpers/fake-auth";
import { generatedSecret } from "../helpers/generated-secret";
import { renderApp } from "../helpers/render-app";

jest.mock("expo-font", () => ({ useFonts: jest.fn(() => [true, null]) }));
jest.mock("expo-splash-screen", () => ({
  preventAutoHideAsync: jest.fn(),
  hide: jest.fn(),
}));
jest.mock("@/auth", () => ({
  auth: jest.requireActual<typeof import("../helpers/fake-auth")>("../helpers/fake-auth").fakeAuth,
}));

const email = "name@email.com";
const url = "/reset-password?email=name%40email.com";
const code = generatedSecret("code");
const newPassword = generatedSecret("password");

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

async function submit() {
  await fireEvent.changeText(screen.getByLabelText("Code"), ` ${code} `);
  await fireEvent.changeText(screen.getByLabelText("New password"), newPassword);
  await fireEvent.press(screen.getByRole("button", { name: "Set new password" }));
}

describe("Reset password screen", () => {
  beforeEach(() => {
    resetFakeAuth();
  });

  it("draws its texts and the form", async () => {
    await renderApp(url, null);
    expect(screen.getByText("Enter your code")).toBeTruthy();
    expect(screen.getByText(resetCodeSentMessage(email))).toBeTruthy();
    expect(screen.getByLabelText("Code").props.keyboardType).toBe("number-pad");
    expect(screen.getByLabelText("New password").props.secureTextEntry).toBe(true);
    expect(screen.getByText("No code?", { exact: false })).toBeTruthy();
  });

  it("asks for a code first when the email param is missing", async () => {
    await renderApp("/reset-password", null);
    expect(screen.getByText(missingResetEmailMessage)).toBeTruthy();
    expect(screen.queryByLabelText("Code")).toBeNull();
    await fireEvent.press(screen.getByRole("button", { name: "Request a code" }));
    expect(screen).toHavePathname("/forgot-password");
  });

  it("shows the field errors and does not call the port when the form is empty", async () => {
    await renderApp(url, null);
    await fireEvent.press(screen.getByRole("button", { name: "Set new password" }));
    expect(screen.getByText("Enter the code from the email.")).toBeTruthy();
    expect(screen.getByText("Enter a new password.")).toBeTruthy();
    expect(fakeAuth.confirmPasswordReset).not.toHaveBeenCalled();
  });

  it("sends the email and the trimmed code to the provider", async () => {
    fakeAuth.confirmPasswordReset.mockResolvedValue({
      ok: false,
      step: "code",
      failure: "invalid_or_expired_code",
    });
    await renderApp(url, null);
    await submit();
    expect(fakeAuth.confirmPasswordReset).toHaveBeenCalledWith({ email, code, newPassword });
  });

  it("moves to Home after the reset succeeds", async () => {
    const session = fakeSession();
    fakeAuth.confirmPasswordReset.mockImplementation(async () => {
      emitSession(session);
      return { ok: true, value: session };
    });
    await renderApp(url, null);
    await submit();
    expect(screen).toHavePathname("/");
    expect(screen.queryByText("Enter your code")).toBeNull();
  });

  it("stays on the reset screen while the session arrives mid-confirmation", async () => {
    const pending = deferred<PasswordResetOutcome>();
    fakeAuth.confirmPasswordReset.mockReturnValue(pending.promise);
    await renderApp(url, null);
    await submit();
    await act(async () => emitSession(fakeSession()));
    expect(screen).toHavePathname("/reset-password");
    expect(screen.queryByText("Home")).toBeNull();
    expect(
      screen.getByRole("button", { name: "Set new password", busy: true, disabled: true }),
    ).toBeTruthy();
    await act(async () => pending.resolve({ ok: true, value: fakeSession() }));
  });

  it("shows the busy button and ignores a second press while the request runs", async () => {
    const pending = deferred<PasswordResetOutcome>();
    fakeAuth.confirmPasswordReset.mockReturnValue(pending.promise);
    await renderApp(url, null);
    await submit();
    await fireEvent.press(screen.getByRole("button", { name: "Set new password", busy: true }));
    expect(fakeAuth.confirmPasswordReset).toHaveBeenCalledTimes(1);
    await act(async () =>
      pending.resolve({ ok: false, step: "code", failure: "invalid_or_expired_code" }),
    );
  });

  it("disables the links while the request runs", async () => {
    fakeAuth.confirmPasswordReset.mockReturnValue(new Promise(() => undefined));
    await renderApp(url, null);
    await submit();
    expect(screen.getByText("Request a new code").props.onPress).toBeUndefined();
  });

  it("shows the invalid or expired code message and keeps the form", async () => {
    fakeAuth.confirmPasswordReset.mockResolvedValue({
      ok: false,
      step: "code",
      failure: "invalid_or_expired_code",
    });
    await renderApp(url, null);
    await submit();
    expect(screen.getByText(authFailureMessage("invalid_or_expired_code"))).toBeTruthy();
    expect(screen.getByLabelText("New password").props.value).toBe(newPassword);
    expect(screen.getByLabelText("Code").props.value).toBe(` ${code} `);
    expect(screen).toHavePathname("/reset-password");
  });

  it("shows the network message at step code", async () => {
    fakeAuth.confirmPasswordReset.mockResolvedValue({
      ok: false,
      step: "code",
      failure: "network",
    });
    await renderApp(url, null);
    await submit();
    expect(screen.getByText(authFailureMessage("network"))).toBeTruthy();
    expect(screen.getByRole("button", { name: "Set new password" })).toBeTruthy();
  });

  it("shows the network message at step password and asks for a new code", async () => {
    fakeAuth.confirmPasswordReset.mockResolvedValue({
      ok: false,
      step: "password",
      failure: "network",
      stillSignedIn: false,
    });
    await renderApp(url, null);
    await submit();
    expect(screen.getByText(/Could not reach the server/)).toBeTruthy();
    expect(screen.getByText(/request a new one/)).toBeTruthy();
    expect(screen.queryByLabelText("Code")).toBeNull();
    expect(screen.getByRole("button", { name: "Request a new code" })).toBeTruthy();
  });

  it("shows the weak password message on the reset screen when the session goes away", async () => {
    fakeAuth.confirmPasswordReset.mockImplementation(async () => {
      emitSession(fakeSession());
      emitSession(null);
      return { ok: false, step: "password", failure: "weak_password", stillSignedIn: false };
    });
    await renderApp(url, null);
    await submit();
    expect(screen).toHavePathname("/reset-password");
    expect(screen.getByText(/too weak/)).toBeTruthy();
  });

  it("asks for a new code after a failed password step, and the button goes to the request screen with the email", async () => {
    fakeAuth.confirmPasswordReset.mockResolvedValue({
      ok: false,
      step: "password",
      failure: "weak_password",
      stillSignedIn: false,
    });
    await renderApp(url, null);
    await submit();
    await fireEvent.press(screen.getByRole("button", { name: "Request a new code" }));
    expect(screen).toHavePathname("/forgot-password");
    expect(screen).toHaveSearchParams({ email });
  });

  it("keeps the reset screen when still signed in, and Continue goes to Home", async () => {
    const session = fakeSession();
    fakeAuth.confirmPasswordReset.mockImplementation(async () => {
      emitSession(session);
      return { ok: false, step: "password", failure: "unknown", stillSignedIn: true };
    });
    await renderApp(url, null);
    await submit();
    expect(screen).toHavePathname("/reset-password");
    expect(screen.getByText(/you are still signed in/)).toBeTruthy();
    await fireEvent.press(screen.getByRole("button", { name: "Continue" }));
    expect(screen).toHavePathname("/");
  });

  it("opens the request screen with the email from the footer", async () => {
    await renderApp(url, null);
    await fireEvent.press(screen.getByText("Request a new code"));
    expect(screen).toHavePathname("/forgot-password");
    expect(screen).toHaveSearchParams({ email });
  });

  describe("leaving without Continue", () => {
    const stillSignedIn: PasswordResetOutcome = {
      ok: false,
      step: "password",
      failure: "unknown",
      stillSignedIn: true,
    };

    async function reachContinue() {
      fakeAuth.confirmPasswordReset.mockImplementation(async () => {
        emitSession(fakeSession());
        return stillSignedIn;
      });
      await renderApp("/forgot-password", null);
      await act(async () => router.push(url));
      await submit();
    }

    it("hides the footer in the continue state", async () => {
      await reachContinue();
      expect(screen.getByRole("button", { name: "Continue" })).toBeTruthy();
      expect(screen.queryByText("Request a new code")).toBeNull();
      expect(screen.queryByText("No code?")).toBeNull();
    });

    it("ignores the back gesture and the back button in the continue state", async () => {
      await reachContinue();
      await act(async () => router.back());
      expect(screen).toHavePathname("/reset-password");
      await fireEvent.press(screen.getByRole("button", { name: "Continue" }));
      expect(screen).toHavePathname("/");
    });

    it("ignores the back gesture while the request runs, and still draws Continue", async () => {
      const pending = deferred<PasswordResetOutcome>();
      fakeAuth.confirmPasswordReset.mockImplementation(() => pending.promise);
      await renderApp("/forgot-password", null);
      await act(async () => router.push(url));
      await submit();
      await act(async () => router.back());
      expect(screen).toHavePathname("/reset-password");
      await act(async () => {
        emitSession(fakeSession());
        pending.resolve(stillSignedIn);
      });
      expect(screen.getByRole("button", { name: "Continue" })).toBeTruthy();
    });

    it("lets the back gesture leave the idle form", async () => {
      await renderApp("/forgot-password", null);
      await act(async () => router.push(url));
      await act(async () => router.back());
      expect(screen).toHavePathname("/forgot-password");
    });
  });
});
