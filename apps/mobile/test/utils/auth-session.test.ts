// apps/mobile/test/utils/auth-session.test.ts
//
// Tests for toAuthSession.
//
// Tested:
// - A library session maps to the app's session shape
//
// What is covered:
// - Normal case, empty case, edges
//
// Run with: pnpm exec jest apps/mobile/test/utils/auth-session.test.ts
//
// SEE: apps/mobile/src/utils/auth-session.ts

import { describe, expect, it } from "@jest/globals";

import { toAuthSession } from "@/utils/auth-session";

describe("toAuthSession", () => {
  it("maps the token, user id and email", () => {
    expect(
      toAuthSession({ access_token: "token-1", user: { id: "user-1", email: "a@example.com" } }),
    ).toEqual({ accessToken: "token-1", user: { id: "user-1", email: "a@example.com" } });
  });

  it("gives a null email when the session has none", () => {
    expect(
      toAuthSession({ access_token: "token-1", user: { id: "user-1" } }).user.email,
    ).toBeNull();
  });

  it("gives a null email when the email is an empty string", () => {
    expect(
      toAuthSession({ access_token: "token-1", user: { id: "user-1", email: "" } }).user.email,
    ).toBeNull();
  });

  it("does not expose the refresh token", () => {
    const librarySession = {
      access_token: "token-1",
      refresh_token: "refresh-1",
      user: { id: "user-1" },
    };
    const session = toAuthSession(librarySession);

    expect(JSON.stringify(session)).not.toContain("refresh");
  });
});
