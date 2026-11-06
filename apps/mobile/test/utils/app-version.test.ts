// apps/mobile/test/utils/app-version.test.ts
//
// Tests for the app version reader.
//
// Tested:
// - appVersion reads the version from the app config and says Unknown without one
//
// What is covered:
// - Normal case, empty case, edges
//
// Run with: pnpm exec jest apps/mobile/test/utils/app-version.test.ts
//
// SEE: apps/mobile/src/utils/app-version.ts

import { describe, expect, it } from "@jest/globals";

import { appVersion } from "@/utils/app-version";

describe("appVersion", () => {
  it("reads the version from the app config", () => {
    expect(appVersion(() => ({ version: "0.1.0" }))).toBe("0.1.0");
  });

  it("says Unknown without a config", () => {
    expect(appVersion(() => null)).toBe("Unknown");
  });

  it("says Unknown with an empty or missing version", () => {
    expect(appVersion(() => ({ version: "" }))).toBe("Unknown");
    expect(appVersion(() => ({}))).toBe("Unknown");
  });
});
