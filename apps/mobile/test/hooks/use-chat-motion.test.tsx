// apps/mobile/test/hooks/use-chat-motion.test.tsx
//
// Tests for the hook that reads the system reduce motion setting.
//
// Tested:
// - useChatMotion gives the animated chat motion when reduce motion is off
//
// What is covered:
// - Normal case; the reduce motion case is chatMotion(true) in chat-motion.test.ts
//
// Run with: pnpm exec jest apps/mobile/test/hooks/use-chat-motion.test.tsx
//
// SEE: apps/mobile/src/hooks/use-chat-motion.ts

import { describe, expect, it } from "@jest/globals";
import { renderHook } from "@testing-library/react-native";

import { useChatMotion } from "@/hooks/use-chat-motion";
import { chatMotion } from "@/utils/chat-motion";

describe("useChatMotion", () => {
  it("gives the animated chat motion when reduce motion is off", async () => {
    const { result } = await renderHook(() => useChatMotion());

    expect(result.current).toEqual(chatMotion(false));
  });
});
