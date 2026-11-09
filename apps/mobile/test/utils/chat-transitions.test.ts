// apps/mobile/test/utils/chat-transitions.test.ts
//
// Tests for the chat transitions built from the motion config.
//
// Tested:
// - enterTransition, fadeInTransition, fadeOutTransition give a Reanimated animation, or none
// - enterTransition applies the optional delay and curve of a motion
// - titleOutTransition and titleInTransition build the header's title swap; renameSheetTransition raises the rename sheet
//
// What is covered:
// - Normal case, reduce motion (no motion), edges
//
// Run with: pnpm exec jest apps/mobile/test/utils/chat-transitions.test.ts
//
// SEE: apps/mobile/src/utils/chat-transitions.ts

import { describe, expect, it } from "@jest/globals";
import { FadeIn, FadeInDown, FadeOut, Keyframe, SlideInDown } from "react-native-reanimated";

import { chatMotion } from "@/utils/chat-motion";
import {
  enterTransition,
  fadeInTransition,
  fadeOutTransition,
  renameSheetTransition,
  titleInTransition,
  titleOutTransition,
} from "@/utils/chat-transitions";

describe("enterTransition", () => {
  it("builds the enter animation from below", () => {
    const { enter } = chatMotion(false);
    expect(enterTransition(enter)).toBeInstanceOf(FadeInDown);
  });

  it("builds no enter animation with reduce motion on", () => {
    expect(enterTransition(chatMotion(true).enter)).toBeUndefined();
  });

  it("applies a delay when the motion has one", () => {
    const built = enterTransition({ duration: 840, offset: 14, delay: 240 });
    expect(built?.getDelay()).toBe(240);
    expect(built?.getDuration()).toBe(840);
  });

  it("has no delay when the motion has none", () => {
    expect(enterTransition(chatMotion(false).enter)?.getDelay()).toBe(0);
  });

  it("builds with a curve of its own", () => {
    const built = enterTransition({ duration: 840, offset: 14, curve: [0.2, 0.7, 0.2, 1] });
    expect(built).toBeInstanceOf(FadeInDown);
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

describe("the title swap", () => {
  it("builds the title's swap out and swap in", () => {
    const { titleSwap } = chatMotion(false);
    expect(titleOutTransition(titleSwap)).toBeInstanceOf(Keyframe);
    expect(titleInTransition(titleSwap)).toBeInstanceOf(Keyframe);
  });

  it("builds no title swap with reduce motion on", () => {
    const { titleSwap } = chatMotion(true);
    expect(titleOutTransition(titleSwap)).toBeUndefined();
    expect(titleInTransition(titleSwap)).toBeUndefined();
  });
});

describe("renameSheetTransition", () => {
  it("raises the rename sheet over 700 ms", () => {
    const built = renameSheetTransition(chatMotion(false).sheet);
    expect(built).toBeInstanceOf(SlideInDown);
    expect(built?.getDuration()).toBe(700);
  });

  it("builds no sheet motion with reduce motion on", () => {
    expect(renameSheetTransition(chatMotion(true).sheet)).toBeUndefined();
  });
});
