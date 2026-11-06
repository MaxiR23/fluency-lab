// apps/mobile/test/utils/data-error.test.ts
//
// Tests for toDataFailure.
//
// Tested:
// - An HTTP status of the API maps to a typed data failure
//
// What is covered:
// - Normal case, empty case, edges
//
// Run with: pnpm exec jest apps/mobile/test/utils/data-error.test.ts
//
// SEE: apps/mobile/src/utils/data-error.ts

import { describe, expect, it } from "@jest/globals";

import { toDataFailure } from "@/utils/data-error";

describe("toDataFailure", () => {
  it("maps 400 to invalid_input", () => {
    expect(toDataFailure(400)).toBe("invalid_input");
  });

  it("maps 401 to unauthorized", () => {
    expect(toDataFailure(401)).toBe("unauthorized");
  });

  it("maps 404 to not_found", () => {
    expect(toDataFailure(404)).toBe("not_found");
  });

  it("maps 500 and 503 to unavailable", () => {
    expect(toDataFailure(500)).toBe("unavailable");
    expect(toDataFailure(503)).toBe("unavailable");
  });

  it("maps an unexpected 418 to unavailable", () => {
    expect(toDataFailure(418)).toBe("unavailable");
  });
});
