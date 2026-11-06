// apps/mobile/test/app-config.test.ts
//
// Cross-cutting tests that the native app config matches the shared tokens.
//
// Tested:
// - The root view background in app.json is the background token
//
// What is covered:
// - Normal case, edges
//
// Run with: pnpm exec jest apps/mobile/test/app-config.test.ts
//
// SEE: apps/mobile/app.json

import { describe, expect, it } from "@jest/globals";

import appConfig from "../app.json";
import { colors } from "@/constants/theme";

describe("app config", () => {
  it("sets the root view background to the background token", () => {
    expect((appConfig.expo as { backgroundColor?: string }).backgroundColor).toBe(
      colors.background,
    );
  });

  it("sets the root view background to black", () => {
    expect((appConfig.expo as { backgroundColor?: string }).backgroundColor).toBe("#000000");
  });
});
