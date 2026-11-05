// apps/mobile/test/utils/auth-message.test.ts
//
// Tests for the auth outcome to message functions.
//
// Tested:
// - One message per failure
// - What each failed reset step tells the user and offers
// - The development line that shows the cause under a failure
//
// What is covered:
// - Normal case, empty case, edges
//
// Run with: pnpm exec jest apps/mobile/test/utils/auth-message.test.ts
//
// SEE: apps/mobile/src/utils/auth-message.ts

import { describe, expect, it } from "@jest/globals";

import type { AppleSignInOutcome, AuthFailure } from "@/auth/auth-port";
import {
  appleNameFailureMessage,
  appleSignInView,
  authFailureMessage,
  authFailureView,
  blocksResetExit,
  failureCauseLine,
  missingResetEmailMessage,
  resetCodeSentMessage,
  resetFailureView,
  signUpPendingMessage,
} from "@/utils/auth-message";

const failures: AuthFailure[] = [
  "invalid_credentials",
  "email_taken",
  "weak_password",
  "invalid_or_expired_code",
  "apple_request_failed",
  "network",
  "unknown",
];

describe("authFailureMessage", () => {
  it("words the invalid credentials failure", () => {
    expect(authFailureMessage("invalid_credentials")).toBe("That email or password is not right.");
  });

  it("words the email taken failure", () => {
    expect(authFailureMessage("email_taken")).toBe(
      "An account with this email already exists. Sign in instead.",
    );
  });

  it("words the weak password failure", () => {
    expect(authFailureMessage("weak_password")).toBe(
      "That password is too weak. Try a longer one.",
    );
  });

  it("words the invalid or expired code failure", () => {
    expect(authFailureMessage("invalid_or_expired_code")).toBe(
      "That code is wrong or has expired.",
    );
  });

  it("words the network failure", () => {
    expect(authFailureMessage("network")).toBe(
      "Could not reach the server. Check your connection and try again.",
    );
  });

  it("words the unknown failure", () => {
    expect(authFailureMessage("unknown")).toBe(
      "Something went wrong. Wait a moment and try again.",
    );
  });

  it("words the Apple request failure", () => {
    expect(authFailureMessage("apple_request_failed")).toBe(
      "Apple could not sign you in. Try again.",
    );
  });

  it("gives each of the seven failures a different message", () => {
    expect(new Set(failures.map(authFailureMessage)).size).toBe(7);
  });
});

describe("appleSignInView", () => {
  it("draws nothing for a signed in outcome", () => {
    expect(appleSignInView({ status: "signed_in" })).toEqual({ kind: "none" });
  });

  it("draws nothing for a cancel", () => {
    expect(appleSignInView({ status: "canceled" })).toEqual({ kind: "none" });
  });

  it("shows the failure's message for a failed Apple sign-in", () => {
    expect(appleSignInView({ status: "failed", failure: "network" })).toEqual({
      kind: "message",
      message: authFailureMessage("network"),
    });
  });

  it("does not use the email and password wording for invalid credentials", () => {
    expect(appleSignInView({ status: "failed", failure: "invalid_credentials" })).toEqual({
      kind: "message",
      message: authFailureMessage("apple_request_failed"),
    });
  });

  it("carries the cause of a failed Apple sign-in into the view", () => {
    const cause = { name: "AuthRetryableFetchError", detail: "offline" };
    expect(appleSignInView({ status: "failed", failure: "network", cause })).toEqual({
      kind: "message",
      message: authFailureMessage("network"),
      cause,
    });
  });

  it("keeps the cause when invalid_credentials reads as the Apple failure", () => {
    const cause = { name: "AuthApiError", detail: null };
    expect(appleSignInView({ status: "failed", failure: "invalid_credentials", cause })).toEqual({
      kind: "message",
      message: authFailureMessage("apple_request_failed"),
      cause,
    });
  });

  it("has no cause in the view when the failure has none", () => {
    const view = appleSignInView({ status: "failed", failure: "network" });
    expect(view.kind).toBe("message");
    expect("cause" in view ? view.cause : undefined).toBeUndefined();
  });

  it("keeps the name and says the user is signed in when the name was not saved", () => {
    const name = { fullName: "Ada Lovelace", givenName: "Ada", familyName: "Lovelace" };
    const outcome: AppleSignInOutcome = { status: "name_not_saved", failure: "unknown", name };
    expect(appleSignInView(outcome)).toEqual({
      kind: "name_not_saved",
      message: `${authFailureMessage("unknown")} You are signed in, but your name was not saved.`,
      name,
    });
  });
});

describe("appleNameFailureMessage", () => {
  it("says the user is signed in but the name was not saved", () => {
    expect(appleNameFailureMessage("network")).toBe(
      `${authFailureMessage("network")} You are signed in, but your name was not saved.`,
    );
  });
});

describe("failureCauseLine", () => {
  it("joins the name and the detail in development", () => {
    expect(failureCauseLine({ name: "AuthRetryableFetchError", detail: "offline" }, true)).toBe(
      "AuthRetryableFetchError: offline",
    );
  });

  it("shows only the name when there is no detail", () => {
    expect(failureCauseLine({ name: "AuthApiError", detail: null }, true)).toBe("AuthApiError");
  });

  it("returns null when there is no cause", () => {
    expect(failureCauseLine(undefined, true)).toBeNull();
  });

  it("returns null outside development even with a cause", () => {
    expect(failureCauseLine({ name: "AuthApiError", detail: "x" }, false)).toBeNull();
  });
});

describe("authFailureView", () => {
  it("pairs the failure message with the cause", () => {
    const cause = { name: "AuthApiError", detail: null };
    expect(authFailureView({ failure: "network", cause })).toEqual({
      message: authFailureMessage("network"),
      cause,
    });
  });

  it("has no cause when the outcome has none", () => {
    expect(authFailureView({ failure: "unknown" }).cause).toBeUndefined();
  });
});

describe("resetFailureView", () => {
  it("carries the cause of the failed step", () => {
    const cause = { name: "AuthRetryableFetchError", detail: "offline" };
    expect(resetFailureView({ ok: false, step: "code", failure: "network", cause }).cause).toEqual(
      cause,
    );
    expect(
      resetFailureView({
        ok: false,
        step: "password",
        failure: "network",
        cause,
        stillSignedIn: false,
      }).cause,
    ).toEqual(cause);
    expect(
      resetFailureView({
        ok: false,
        step: "password",
        failure: "network",
        cause,
        stillSignedIn: true,
      }).cause,
    ).toEqual(cause);
  });

  it("keeps the failure's message and offers a retry at step code", () => {
    expect(
      resetFailureView({ ok: false, step: "code", failure: "invalid_or_expired_code" }),
    ).toEqual({ message: authFailureMessage("invalid_or_expired_code"), action: "retry" });
  });

  it("asks for a new code at step password when signed out", () => {
    expect(
      resetFailureView({ ok: false, step: "password", failure: "network", stillSignedIn: false }),
    ).toEqual({
      message: `${authFailureMessage("network")} Your code was used, so request a new one.`,
      action: "request_new_code",
    });
  });

  it("keeps the weak password message at step password and says the code was used", () => {
    const view = resetFailureView({
      ok: false,
      step: "password",
      failure: "weak_password",
      stillSignedIn: false,
    });
    expect(view.message).toContain(authFailureMessage("weak_password"));
    expect(view.message).toContain("Your code was used");
  });

  it("offers continue at step password when still signed in", () => {
    expect(
      resetFailureView({ ok: false, step: "password", failure: "unknown", stillSignedIn: true }),
    ).toEqual({
      message: `${authFailureMessage("unknown")} Your password did not change, and you are still signed in.`,
      action: "continue",
    });
  });
});

describe("resetCodeSentMessage", () => {
  it("names the email and does not claim the account exists", () => {
    const message = resetCodeSentMessage("name@email.com");
    expect(message).toBe("If an account exists for name@email.com, we sent it a code.");
  });
});

describe("fixed messages", () => {
  it("words the sign up pending and the missing email messages", () => {
    expect(signUpPendingMessage).toBe("Check your email to confirm your account, then sign in.");
    expect(missingResetEmailMessage).toBe("Request a code first.");
  });
});

describe("blocksResetExit", () => {
  it("blocks while the request runs", () => {
    expect(blocksResetExit(true, "retry")).toBe(true);
  });

  it("blocks in the continue state", () => {
    expect(blocksResetExit(false, "continue")).toBe(true);
  });

  it("does not block the form, or the request for a new code, when idle", () => {
    expect(blocksResetExit(false, "retry")).toBe(false);
    expect(blocksResetExit(false, "request_new_code")).toBe(false);
  });
});
