// apps/mobile/test/utils/auth-error.test.ts
//
// Tests for toAuthFailure, describeAuthCause and redactCauseDetail.
//
// Tested:
// - A library error maps to one typed failure the screen can branch on
// - A failure keeps the error name and, for transport failures, the redacted message
// - The cause never holds a token, key, password, email or request body
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

import { describeAuthCause, redactCauseDetail, toAuthFailure } from "@/utils/auth-error";

import { generatedSecret } from "../helpers/generated-secret";

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

const offline = "fetch failed: The Internet connection appears to be offline.";

describe("describeAuthCause", () => {
  it("keeps the name and the message of a transport failure", () => {
    expect(describeAuthCause(new AuthRetryableFetchError(offline, 0))).toEqual({
      name: "AuthRetryableFetchError",
      detail: offline,
    });
  });

  it("keeps only the name of an API error", () => {
    expect(
      describeAuthCause(new AuthApiError("Invalid login", 400, "invalid_credentials")),
    ).toEqual({ name: "AuthApiError", detail: null });
  });

  it("describes null and undefined as unknown with no detail", () => {
    expect(describeAuthCause(null)).toEqual({ name: "unknown", detail: null });
    expect(describeAuthCause(undefined)).toEqual({ name: "unknown", detail: null });
  });

  it("keeps no detail when a transport failure has no message", () => {
    expect(describeAuthCause({ name: "AuthRetryableFetchError" })).toEqual({
      name: "AuthRetryableFetchError",
      detail: null,
    });
  });

  it("keeps no detail when the transport message is only spaces", () => {
    expect(describeAuthCause({ name: "AuthRetryableFetchError", message: "   " })).toEqual({
      name: "AuthRetryableFetchError",
      detail: null,
    });
  });

  it("does not carry a thrown string", () => {
    expect(describeAuthCause("boom")).toEqual({ name: "unknown", detail: null });
  });

  it("replaces a name that is not an identifier with unknown", () => {
    expect(describeAuthCause({ name: "a@example.com" }).name).toBe("unknown");
    expect(describeAuthCause({ name: "A".repeat(65) }).name).toBe("unknown");
  });

  it("keeps no detail from an API error whose message holds a bare password", () => {
    const secret = generatedSecret("password");
    const cause = describeAuthCause(new AuthApiError(`bad ${secret}`, 400, "validation_failed"));
    expect(cause.detail).toBeNull();
    expect(JSON.stringify(cause)).not.toContain(secret);
  });

  it("does not change the category toAuthFailure returns for the same error", () => {
    expect(toAuthFailure(new AuthRetryableFetchError(offline, 0))).toBe("network");
    expect(toAuthFailure(new AuthApiError("x", 400, "invalid_credentials"))).toBe(
      "invalid_credentials",
    );
    expect(toAuthFailure("boom")).toBe("unknown");
  });
});

describe("redactCauseDetail", () => {
  it("removes an access token", () => {
    const jwt = `eyJ${generatedSecret("a")}.${generatedSecret("b")}.${generatedSecret("c")}`;
    const result = redactCauseDetail(`fetch failed: got ${jwt} here`);
    expect(result).not.toContain(jwt);
    expect(result).toContain("fetch failed: got");
    expect(result).toContain("here");
  });

  it("removes a bearer value", () => {
    const secret = generatedSecret("bearer");
    const result = redactCauseDetail(`failed with Bearer ${secret} sent`);
    expect(result).not.toContain(secret);
    expect(result).toContain("failed with");
  });

  it("removes an API key", () => {
    const key = `sk-${"a1".repeat(16)}`;
    const result = redactCauseDetail(`fetch failed: used ${key} today`);
    expect(result).not.toContain(key);
    expect(result).toContain("fetch failed: used");
  });

  it("removes a Supabase key", () => {
    const key = `sb_publishable_${generatedSecret("key")}`;
    const result = redactCauseDetail(`fetch failed: ${key} refused`);
    expect(result).not.toContain(key);
    expect(result).toContain("refused");
  });

  it("removes a labeled password", () => {
    const secret = generatedSecret("password");
    const plain = redactCauseDetail(`fetch failed password=${secret} end`);
    const json = redactCauseDetail(`fetch failed "password":"${secret}" end`);
    expect(plain).not.toContain(secret);
    expect(json).not.toContain(secret);
    expect(plain).toContain("fetch failed");
  });

  it("removes an email", () => {
    const result = redactCauseDetail("fetch failed for name@email.com today");
    expect(result).not.toContain("name@email.com");
    expect(result).toBe("fetch failed for [email] today");
  });

  it("removes a request body", () => {
    const secret = generatedSecret("password");
    const result = redactCauseDetail(
      `fetch failed: {"email":"name@email.com","password":"${secret}"}`,
    );
    expect(result).toBe("fetch failed: [body]");
  });

  it("drops the query and the credentials of a URL", () => {
    const secret = generatedSecret("pw");
    const result = redactCauseDetail(
      `failed http://user:${secret}@localhost:54321/auth/v1/token?grant_type=password&apikey=${secret}`,
    );
    expect(result).toBe("failed http://localhost:54321/auth/v1/token");
  });

  it("keeps a native message with no secret as it is", () => {
    expect(redactCauseDetail(offline)).toBe(offline);
    expect(redactCauseDetail("NSURLErrorDomain code -1009")).toContain("NSURLErrorDomain");
  });

  it("returns null for an empty message", () => {
    expect(redactCauseDetail("")).toBeNull();
    expect(redactCauseDetail("  \n ")).toBeNull();
  });

  it("collapses line breaks into single spaces", () => {
    expect(redactCauseDetail("one\n\ntwo\r\nthree")).toBe("one two three");
  });

  it("keeps a message one under the maximum length", () => {
    expect(redactCauseDetail("a".repeat(199))).toHaveLength(199);
  });

  it("keeps a message of exactly the maximum length", () => {
    expect(redactCauseDetail("a".repeat(200))).toHaveLength(200);
  });

  it("cuts a message one over the maximum length", () => {
    expect(redactCauseDetail("a".repeat(201))).toHaveLength(200);
  });
});
