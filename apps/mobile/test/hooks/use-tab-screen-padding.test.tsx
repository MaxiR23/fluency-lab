// apps/mobile/test/hooks/use-tab-screen-padding.test.tsx
//
// Tests for the hook that pads a tab screen so its content clears the floating bar.
//
// Tested:
// - useTabScreenPadding pads the bottom by the tab bar clearance of the bottom inset
//
// What is covered:
// - Normal case, edges
//
// Run with: pnpm exec jest apps/mobile/test/hooks/use-tab-screen-padding.test.tsx
//
// SEE: apps/mobile/src/hooks/use-tab-screen-padding.ts

import { describe, expect, it } from "@jest/globals";
import { renderHook } from "@testing-library/react-native";
import type { ReactNode } from "react";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { useTabScreenPadding } from "@/hooks/use-tab-screen-padding";
import { tabBarLayout } from "@/utils/tab-bar";

function withInset(bottom: number) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return (
      <SafeAreaProvider
        initialMetrics={{
          frame: { x: 0, y: 0, width: 390, height: 844 },
          insets: { top: 0, left: 0, right: 0, bottom },
        }}
      >
        {children}
      </SafeAreaProvider>
    );
  };
}

describe("useTabScreenPadding", () => {
  it.each([0, 34])("pads by the tab bar clearance of a %s bottom inset", async (bottom) => {
    const { result } = await renderHook(() => useTabScreenPadding(), {
      wrapper: withInset(bottom),
    });

    expect(result.current).toEqual({ paddingBottom: tabBarLayout(bottom).clearance });
  });
});
