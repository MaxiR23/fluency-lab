// apps/mobile/test/utils/reply-swipe.test.ts
//
// Tests for the pure functions of the reply swipe.
//
// Tested:
// - swipeOffset: the bubble follows the finger to the right, up to the travel
// - swipeArmed and armCrossed: when the swipe reaches the threshold, and the move that arms it
// - hintLook: the hint's opacity and scale by how far the bubble moved
// - replyPanOffsets: the slop that lets the list's vertical scroll win
//
// What is covered:
// - Normal case, empty case, edges
//
// Run with: pnpm exec jest apps/mobile/test/utils/reply-swipe.test.ts
//
// SEE: apps/mobile/src/utils/reply-swipe.ts

import { describe, expect, it } from "@jest/globals";

import {
  armCrossed,
  hintLook,
  replyPanOffsets,
  swipeArmed,
  swipeOffset,
} from "@/utils/reply-swipe";

describe("swipeOffset", () => {
  it("follows the finger to the right", () => {
    expect(swipeOffset(30, 56)).toBe(30);
  });

  it("stays at 0 for a left move", () => {
    expect(swipeOffset(-20, 56)).toBe(0);
  });

  it("stops at the travel", () => {
    expect(swipeOffset(200, 56)).toBe(56);
  });

  it("is 0 with no move", () => {
    expect(swipeOffset(0, 56)).toBe(0);
  });
});

describe("swipeArmed", () => {
  it("arms exactly at the travel", () => {
    expect(swipeArmed(56, 56)).toBe(true);
  });

  it("does not arm one point short", () => {
    expect(swipeArmed(55, 56)).toBe(false);
  });

  it("stays armed past the travel", () => {
    expect(swipeArmed(120, 56)).toBe(true);
  });

  it("never arms with a travel of 0", () => {
    expect(swipeArmed(10, 0)).toBe(false);
    expect(swipeArmed(0, 0)).toBe(false);
  });
});

describe("armCrossed", () => {
  it("fires on the move that arms", () => {
    expect(armCrossed(false, true)).toBe(true);
  });

  it("does not fire while it stays armed", () => {
    expect(armCrossed(true, true)).toBe(false);
  });

  it("does not fire on disarming", () => {
    expect(armCrossed(true, false)).toBe(false);
  });

  it("does not fire while disarmed", () => {
    expect(armCrossed(false, false)).toBe(false);
  });
});

describe("hintLook", () => {
  it("is hidden at the start scale with no offset", () => {
    expect(hintLook(0, 56, 0.6)).toEqual({ opacity: 0, scale: 0.6 });
  });

  it("is fully shown at scale 1 at the travel", () => {
    expect(hintLook(56, 56, 0.6)).toEqual({ opacity: 1, scale: 1 });
  });

  it("is half way at half the travel", () => {
    const look = hintLook(28, 56, 0.6);
    expect(look.opacity).toBeCloseTo(0.5);
    expect(look.scale).toBeCloseTo(0.8);
  });

  it("never passes 1 or the travel", () => {
    expect(hintLook(90, 56, 0.6)).toEqual({ opacity: 1, scale: 1 });
    expect(hintLook(-10, 56, 0.6)).toEqual({ opacity: 0, scale: 0.6 });
  });

  it("is hidden with a travel of 0", () => {
    expect(hintLook(10, 0, 0.6)).toEqual({ opacity: 0, scale: 0.6 });
  });
});

describe("replyPanOffsets", () => {
  it("activates on a rightward move of the slop and fails on a vertical move of the slop", () => {
    expect(replyPanOffsets(10)).toEqual({ activeOffsetX: 10, failOffsetY: [-10, 10] });
  });

  it("a slop of 0 gives zero offsets", () => {
    expect(replyPanOffsets(0)).toEqual({ activeOffsetX: 0, failOffsetY: [-0, 0] });
  });
});
