// apps/mobile/test/utils/api-env.test.ts
//
// Tests for readApiUrl.
//
// Tested:
// - The API url is read, and a missing one fails at load
//
// What is covered:
// - Normal case, empty case, edges
//
// Run with: pnpm exec jest apps/mobile/test/utils/api-env.test.ts
//
// SEE: apps/mobile/src/utils/api-env.ts

import { describe, expect, it } from "@jest/globals";

import { readApiUrl } from "@/utils/api-env";

describe("readApiUrl", () => {
  it("returns the url", () => {
    expect(readApiUrl("http://host:3000")).toBe("http://host:3000");
  });

  it("throws naming EXPO_PUBLIC_API_URL when it is missing", () => {
    expect(() => readApiUrl(undefined)).toThrow("EXPO_PUBLIC_API_URL");
  });

  it("treats a blank value as missing", () => {
    expect(() => readApiUrl("   ")).toThrow("EXPO_PUBLIC_API_URL");
  });

  it("drops a trailing slash", () => {
    expect(readApiUrl("http://host:3000/")).toBe("http://host:3000");
  });

  it("does not put the value in the error message", () => {
    expect.assertions(1);
    try {
      readApiUrl("   ");
    } catch (error) {
      expect(String(error)).not.toContain("   ");
    }
  });
});
