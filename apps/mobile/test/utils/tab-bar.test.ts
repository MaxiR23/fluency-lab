// apps/mobile/test/utils/tab-bar.test.ts
//
// Tests for the floating tab bar's layout and pill.
//
// Tested:
// - tabBarLayout: the bar's bottom, height and the clearance tab screens pad by
// - pillWidth and pillOffset: the pill's size and place in the measured row
// - tabPillMotion: the spring, or none with reduce motion
//
// What is covered:
// - Normal case, empty case, edges
//
// Run with: pnpm exec jest apps/mobile/test/utils/tab-bar.test.ts
//
// SEE: apps/mobile/src/utils/tab-bar.ts

import { describe, expect, it } from "@jest/globals";

import { motion } from "@/constants/theme";
import { pillOffset, pillWidth, tabBarLayout, tabPillMotion } from "@/utils/tab-bar";

describe("tabBarLayout", () => {
  it("floats the bar 30 above the bottom with no inset and pads content by the design's 110", () => {
    expect(tabBarLayout(0)).toEqual({ bottom: 30, height: 66, clearance: 110 });
  });

  it("floats the bar on the inset when it is larger than 30", () => {
    expect(tabBarLayout(34)).toEqual({ bottom: 34, height: 66, clearance: 114 });
  });

  it("floats the bar at 30 when the inset is exactly 30", () => {
    expect(tabBarLayout(30).bottom).toBe(30);
  });

  it("keeps 30 for an inset of 29 and takes 31 for an inset of 31", () => {
    expect(tabBarLayout(29).bottom).toBe(30);
    expect(tabBarLayout(31).bottom).toBe(31);
  });
});

describe("pillWidth", () => {
  it("splits the row evenly between the tabs", () => {
    expect(pillWidth(300, 3)).toBe(100);
  });

  it("gives no width before the row is measured", () => {
    expect(pillWidth(0, 3)).toBe(0);
  });

  it("gives no width with no tabs", () => {
    expect(pillWidth(300, 0)).toBe(0);
  });

  it("keeps the fraction of a row that does not divide evenly", () => {
    expect(pillWidth(301, 3)).toBe(301 / 3);
  });
});

describe("pillOffset", () => {
  it("places the pill under the current tab", () => {
    expect(pillOffset(0, 300, 3)).toBe(0);
    expect(pillOffset(2, 300, 3)).toBe(200);
  });

  it("places the pill at the start before the row is measured", () => {
    expect(pillOffset(1, 0, 3)).toBe(0);
  });

  it("places the pill at the start with no tabs", () => {
    expect(pillOffset(0, 300, 0)).toBe(0);
  });

  it("keeps the pill on the last tab for an index past the end", () => {
    expect(pillOffset(5, 300, 3)).toBe(200);
  });

  it("keeps the pill on the first tab for a negative index", () => {
    expect(pillOffset(-1, 300, 3)).toBe(0);
  });
});

describe("tabPillMotion", () => {
  it("springs the pill for the design's 420 ms with no overshoot when reduce motion is off", () => {
    expect(tabPillMotion(false)).toEqual({ duration: motion.pillDuration, dampingRatio: 1 });
    expect(motion.pillDuration * 1.5).toBe(420);
  });

  it("does not animate the pill with reduce motion on", () => {
    expect(tabPillMotion(true)).toBeNull();
  });

  it("gives the same spring object every call", () => {
    expect(tabPillMotion(false)).toBe(tabPillMotion(false));
  });
});
