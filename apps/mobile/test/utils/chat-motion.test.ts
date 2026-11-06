// apps/mobile/test/utils/chat-motion.test.ts
//
// Tests for the chat motion pure functions.
//
// Tested:
// - chatMotion gives the design's motion, or none with reduce motion on
// - dotPhases splits the dot cycle
// - dotDelay staggers the dots
// - pressedScale scales Send while pressed
//
// What is covered:
// - Normal case, empty case, edges
//
// Run with: pnpm exec jest apps/mobile/test/utils/chat-motion.test.ts
//
// SEE: apps/mobile/src/utils/chat-motion.ts

import { describe, expect, it } from "@jest/globals";

import { chatMotion, dotDelay, dotPhases, pressedScale } from "@/utils/chat-motion";

describe("chatMotion", () => {
  it("gives the enter, fade, press and dot motion of the design when reduce motion is off", () => {
    expect(chatMotion(false)).toEqual({
      enter: { duration: 240, offset: 12 },
      fade: { duration: 200 },
      press: { duration: 200, scale: 0.9 },
      dots: { rise: 360, fall: 360, rest: 480, stagger: 150, lift: 4, restOpacity: 0.3 },
      preview: { duration: 240, offset: 8 },
      swipeBack: { duration: 240 },
    });
  });

  it("gives the reply preview the design's 8 point rise and the snap back the enter duration", () => {
    const m = chatMotion(false);
    expect(m.preview).toEqual({ duration: 240, offset: 8 });
    expect(m.swipeBack).toEqual({ duration: 240 });
  });

  it("turns the preview and the snap back off with reduce motion", () => {
    const m = chatMotion(true);
    expect(m.preview).toBeNull();
    expect(m.swipeBack).toBeNull();
  });

  it("turns every animation off when reduce motion is on", () => {
    expect(chatMotion(true)).toEqual({
      enter: null,
      fade: null,
      press: null,
      dots: null,
      preview: null,
      swipeBack: null,
    });
  });
});

describe("dotPhases", () => {
  it("splits the 1.2 s dot cycle into rise, fall and rest of the design", () => {
    expect(dotPhases(1200)).toEqual({ rise: 360, fall: 360, rest: 480 });
  });

  it("gives no phases for a zero cycle", () => {
    expect(dotPhases(0)).toEqual({ rise: 0, fall: 0, rest: 0 });
  });

  it("keeps the phases adding up to the cycle when it does not divide evenly", () => {
    const { rise, fall, rest } = dotPhases(1001);
    expect(rise + fall + rest).toBe(1001);
  });

  it("gives no phases for a negative cycle", () => {
    expect(dotPhases(-5)).toEqual({ rise: 0, fall: 0, rest: 0 });
  });
});

describe("dotDelay", () => {
  it("starts the first dot at once", () => {
    expect(dotDelay(0, 150)).toBe(0);
  });

  it("staggers the third dot by two steps", () => {
    expect(dotDelay(2, 150)).toBe(300);
  });

  it("never delays a negative index", () => {
    expect(dotDelay(-1, 150)).toBe(0);
  });
});

describe("pressedScale", () => {
  const press = { duration: 200, scale: 0.9 };

  it("scales Send down while pressed", () => {
    expect(pressedScale(true, press)).toBe(0.9);
  });

  it("keeps Send at full scale when not pressed", () => {
    expect(pressedScale(false, press)).toBe(1);
  });

  it("keeps Send at full scale with reduce motion on", () => {
    expect(pressedScale(true, null)).toBe(1);
  });
});
