// apps/mobile/test/utils/auth-error.test.ts
//
// Tests for toAuthFailure.
//
// Tested:
// - A library error maps to one typed failure the screen can branch on
//
// What is covered:
// - Normal case, empty case, edges
//
// Run with: pnpm exec jest apps/mobile/test/utils/auth-error.test.ts
//
// SEE: apps/mobile/src/utils/auth-error.ts

import { describe, expect, it } from "@jest/globals";
import {
  AuthApiError,
  AuthRetryableFetchError,
  AuthWeakPasswordError,
} from "@supabase/supabase-js";

import { toAuthFailure } from "@/utils/auth-error";

describe("toAuthFailure", () => {
  it("maps invalid_credentials to invalid_credentials", () => {
    expect(toAuthFailure({ name: "AuthApiError", code: "invalid_credentials" })).toBe(
      "invalid_credentials",
    );
  });

  it("maps user_already_exists to email_taken", () => {
    expect(toAuthFailure({ name: "AuthApiError", code: "user_already_exists" })).toBe(
      "email_taken",
    );
  });

  it("maps email_exists to email_taken", () => {
    expect(toAuthFailure({ name: "AuthApiError", code: "email_exists" })).toBe("email_taken");
  });

  it("maps weak_password to weak_password", () => {
    expect(toAuthFailure({ name: "AuthApiError", code: "weak_password" })).toBe("weak_password");
  });

  it("maps otp_expired to invalid_or_expired_code", () => {
    expect(toAuthFailure({ name: "AuthApiError", code: "otp_expired" })).toBe(
      "invalid_or_expired_code",
    );
  });

  it("maps AuthRetryableFetchError to network", () => {
    expect(toAuthFailure({ name: "AuthRetryableFetchError" })).toBe("network");
  });

  it("maps an error with no code to unknown", () => {
    expect(toAuthFailure({ name: "AuthApiError" })).toBe("unknown");
  });

  it("maps null and undefined to unknown", () => {
    expect(toAuthFailure(null)).toBe("unknown");
    expect(toAuthFailure(undefined)).toBe("unknown");
  });

  it("maps a code it does not know, such as validation_failed, to unknown", () => {
    expect(toAuthFailure({ name: "AuthApiError", code: "validation_failed" })).toBe("unknown");
  });

  it("maps a string thrown instead of an error to unknown", () => {
    expect(toAuthFailure("boom")).toBe("unknown");
  });

  it("ignores the message when the code is unknown", () => {
    expect(
      toAuthFailure({ name: "AuthApiError", code: "x", message: "Invalid login credentials" }),
    ).toBe("unknown");
  });

  it("recognises real AuthRetryableFetchError, AuthApiError and AuthWeakPasswordError instances", () => {
    expect(toAuthFailure(new AuthRetryableFetchError("offline", 0))).toBe("network");
    expect(toAuthFailure(new AuthApiError("bad", 400, "invalid_credentials"))).toBe(
      "invalid_credentials",
    );
    expect(toAuthFailure(new AuthWeakPasswordError("short", 422, []))).toBe("weak_password");
  });
});
