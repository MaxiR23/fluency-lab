// apps/mobile/test/utils/chat-transitions.test.ts
//
// Tests for the chat transitions built from the motion config.
//
// Tested:
// - enterTransition, fadeInTransition, fadeOutTransition give a Reanimated animation, or none
//
// What is covered:
// - Normal case, reduce motion (no motion), edges
//
// Run with: pnpm exec jest apps/mobile/test/utils/chat-transitions.test.ts
//
// SEE: apps/mobile/src/utils/chat-transitions.ts

import { describe, expect, it } from "@jest/globals";
import { FadeIn, FadeInDown, FadeOut } from "react-native-reanimated";

import { chatMotion } from "@/utils/chat-motion";
import { enterTransition, fadeInTransition, fadeOutTransition } from "@/utils/chat-transitions";

describe("enterTransition", () => {
  it("builds the enter animation from below", () => {
    const { enter } = chatMotion(false);
    expect(enterTransition(enter)).toBeInstanceOf(FadeInDown);
  });

  it("builds no enter animation with reduce motion on", () => {
    expect(enterTransition(chatMotion(true).enter)).toBeUndefined();
  });
});

describe("fadeInTransition", () => {
  it("builds the fade in", () => {
    expect(fadeInTransition(chatMotion(false).fade)).toBeInstanceOf(FadeIn);
  });

  it("builds no fade in with reduce motion on", () => {
    expect(fadeInTransition(chatMotion(true).fade)).toBeUndefined();
  });
});

describe("fadeOutTransition", () => {
  it("builds the fade out", () => {
    expect(fadeOutTransition(chatMotion(false).fade)).toBeInstanceOf(FadeOut);
  });

  it("builds no fade out with reduce motion on", () => {
    expect(fadeOutTransition(chatMotion(true).fade)).toBeUndefined();
  });
});
