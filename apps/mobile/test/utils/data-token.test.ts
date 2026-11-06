// apps/mobile/test/utils/data-token.test.ts
//
// Tests for toTokenRead.
//
// Tested:
// - The outcome of reading the auth session becomes a token or a typed failure
//
// What is covered:
// - Normal case, empty case, edges
//
// Run with: pnpm exec jest apps/mobile/test/utils/data-token.test.ts
//
// SEE: apps/mobile/src/utils/data-token.ts

import { describe, expect, it } from "@jest/globals";

import { toTokenRead } from "@/utils/data-token";

describe("toTokenRead", () => {
  it("returns the access token of the session", () => {
    const outcome = {
      ok: true,
      value: { accessToken: "token-1", user: { id: "u1", email: null } },
    } as const;
    expect(toTokenRead(outcome)).toEqual({ ok: true, token: "token-1" });
  });

  it("returns unauthorized when there is no session", () => {
    expect(toTokenRead({ ok: true, value: null })).toEqual({ ok: false, failure: "unauthorized" });
  });

  it("returns network when the session read fails on the network", () => {
    expect(toTokenRead({ ok: false, failure: "network" })).toEqual({
      ok: false,
      failure: "network",
    });
  });

  it("returns unavailable for any other failure of the read", () => {
    expect(toTokenRead({ ok: false, failure: "unknown" })).toEqual({
      ok: false,
      failure: "unavailable",
    });
  });
});
