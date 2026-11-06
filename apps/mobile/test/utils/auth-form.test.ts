// apps/mobile/test/utils/auth-form.test.ts
//
// Tests for the auth form helpers.
//
// Tested:
// - Email normalization and the field checks of the three forms
// - Reading the email route param
//
// What is covered:
// - Normal case, empty case, edges
//
// Run with: pnpm exec jest apps/mobile/test/utils/auth-form.test.ts
//
// SEE: apps/mobile/src/utils/auth-form.ts

import { describe, expect, it } from "@jest/globals";

import {
  hasFieldErrors,
  normalizeEmail,
  normalizeName,
  readEmailParam,
  validateCredentials,
  validateResetConfirm,
  validateResetRequest,
  validateSignUp,
} from "@/utils/auth-form";
import { generatedSecret } from "../helpers/generated-secret";

const email = "name@email.com";

describe("normalizeEmail", () => {
  it("trims the spaces around an email", () => {
    expect(normalizeEmail(`  ${email} `)).toBe(email);
  });

  it("returns an empty string for only spaces", () => {
    expect(normalizeEmail("   ")).toBe("");
  });
});

describe("validateCredentials", () => {
  const password = generatedSecret("password");

  it("returns no errors for a valid email and a password", () => {
    expect(validateCredentials({ email, password })).toEqual({});
  });

  it("asks for both fields when both are empty", () => {
    expect(validateCredentials({ email: "", password: "" })).toEqual({
      email: "Enter your email.",
      password: "Enter your password.",
    });
  });

  it("asks for the email when it is only spaces", () => {
    expect(validateCredentials({ email: "   ", password }).email).toBe("Enter your email.");
  });

  it("rejects an email with no at sign", () => {
    expect(validateCredentials({ email: "name.email.com", password }).email).toBe(
      "Enter a valid email.",
    );
  });

  it("rejects an email with two at signs", () => {
    expect(validateCredentials({ email: "a@b@email.com", password }).email).toBe(
      "Enter a valid email.",
    );
  });

  it("rejects an email with no dot in the domain", () => {
    expect(validateCredentials({ email: "name@email", password }).email).toBe(
      "Enter a valid email.",
    );
  });

  it("accepts a valid email with spaces around it", () => {
    expect(validateCredentials({ email: ` ${email} `, password })).toEqual({});
  });

  it("accepts a password of only spaces and leaves it to the server", () => {
    expect(validateCredentials({ email, password: "   " })).toEqual({});
  });

  it("accepts a one-character password and leaves the length to the server", () => {
    expect(validateCredentials({ email, password: generatedSecret("short").slice(0, 1) })).toEqual(
      {},
    );
  });
});

describe("validateResetRequest", () => {
  it("returns no errors for a valid email", () => {
    expect(validateResetRequest({ email })).toEqual({});
  });

  it("asks for an empty email", () => {
    expect(validateResetRequest({ email: "" })).toEqual({ email: "Enter your email." });
  });

  it("rejects a malformed email", () => {
    expect(validateResetRequest({ email: "nope" })).toEqual({ email: "Enter a valid email." });
  });
});

describe("validateResetConfirm", () => {
  const newPassword = generatedSecret("password");
  const code = generatedSecret("code");

  it("returns no errors for a code and a password", () => {
    expect(validateResetConfirm({ code, newPassword })).toEqual({});
  });

  it("asks for both when empty", () => {
    expect(validateResetConfirm({ code: "", newPassword: "" })).toEqual({
      code: "Enter the code from the email.",
      password: "Enter a new password.",
    });
  });

  it("asks for a code of only spaces", () => {
    expect(validateResetConfirm({ code: "  ", newPassword }).code).toBe(
      "Enter the code from the email.",
    );
  });

  it("does not check the code's length", () => {
    expect(validateResetConfirm({ code: "1", newPassword })).toEqual({});
  });
});

describe("hasFieldErrors", () => {
  it("is false for no errors", () => {
    expect(hasFieldErrors({})).toBe(false);
  });

  it("is true for one error", () => {
    expect(hasFieldErrors({ code: "x" })).toBe(true);
  });
});

describe("readEmailParam", () => {
  it("returns the email", () => {
    expect(readEmailParam(email)).toBe(email);
  });

  it("returns null when undefined", () => {
    expect(readEmailParam(undefined)).toBeNull();
  });

  it("returns null for an empty or blank value", () => {
    expect(readEmailParam("")).toBeNull();
    expect(readEmailParam("   ")).toBeNull();
  });

  it("returns the first of an array", () => {
    expect(readEmailParam([` ${email} `, "other@email.com"])).toBe(email);
  });

  it("returns null for an empty array", () => {
    expect(readEmailParam([])).toBeNull();
  });
});

describe("normalizeName", () => {
  it("trims the name", () => {
    expect(normalizeName("  Ana Ruiz  ")).toBe("Ana Ruiz");
  });
});

describe("validateSignUp", () => {
  const password = generatedSecret("password");

  it("returns no errors for a name, an email and a password", () => {
    expect(validateSignUp({ name: "Ana", email, password })).toEqual({});
  });

  it("asks for the name when it is empty", () => {
    expect(validateSignUp({ name: "", email, password })).toEqual({ name: "Enter your name." });
  });

  it("asks for the name when it is only spaces", () => {
    expect(validateSignUp({ name: "   ", email, password })).toEqual({
      name: "Enter your name.",
    });
  });

  it("keeps the email and password errors beside the name error", () => {
    expect(validateSignUp({ name: "", email: "", password: "" })).toEqual({
      name: "Enter your name.",
      email: "Enter your email.",
      password: "Enter your password.",
    });
  });

  it("trims the name", () => {
    expect(normalizeName(" Ana ")).toBe("Ana");
  });
});
