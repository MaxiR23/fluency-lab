// apps/mobile/test/hooks/use-tab-pill-motion.test.tsx
//
// Tests for the hook that reads the system reduce motion setting for the tab pill.
//
// Tested:
// - useTabPillMotion gives the pill spring when reduce motion is off
//
// What is covered:
// - Normal case; the reduce motion case is tabPillMotion(true) in tab-bar.test.ts
//
// Run with: pnpm exec jest apps/mobile/test/hooks/use-tab-pill-motion.test.tsx
//
// SEE: apps/mobile/src/hooks/use-tab-pill-motion.ts

import { describe, expect, it } from "@jest/globals";
import { renderHook } from "@testing-library/react-native";

import { useTabPillMotion } from "@/hooks/use-tab-pill-motion";
import { tabPillMotion } from "@/utils/tab-bar";

describe("useTabPillMotion", () => {
  it("gives the pill spring when reduce motion is off", async () => {
    const { result } = await renderHook(() => useTabPillMotion());

    expect(result.current).toBe(tabPillMotion(false));
  });
});
