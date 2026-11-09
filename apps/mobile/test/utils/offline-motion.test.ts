// apps/mobile/test/utils/offline-motion.test.ts
//
// Tests for offlineMotion, the motion of the can't-connect screens.
//
// Tested:
// - The rise, the two rings and the spinner of offline.html, offline-retrying.html and offline-inline.html
// - Reduce motion turns every animation off
//
// What is covered:
// - Normal case, reduce motion, edges
//
// Run with: pnpm exec jest apps/mobile/test/utils/offline-motion.test.ts
//
// SEE: apps/mobile/src/utils/offline-motion.ts

import { describe, expect, it } from "@jest/globals";

import { motion } from "@/constants/theme";
import { offlineMotion } from "@/utils/offline-motion";

function on() {
  const built = offlineMotion(false);
  if (built === null) throw new Error("offline motion is off without reduce motion");
  return built;
}

describe("offlineMotion", () => {
  it("rises 10 points in 1000 ms on ease-out", () => {
    expect(on().rise).toEqual({
      duration: motion.offline.riseDuration,
      offset: motion.offline.riseOffset,
      curve: motion.easeOut,
    });
    expect(on().rise.duration).toBe(1000);
    expect(on().rise.offset).toBe(10);
  });

  it("starts the first ring at once and the second 1200 ms later, both every 2400 ms", () => {
    expect(on().ring.delays).toEqual([0, 1200]);
    expect(on().ring.cycle).toBe(2400);
  });

  it("grows each ring from .8 to 1.6 while it fades from .6 to 0", () => {
    expect(on().ring).toMatchObject({ from: 0.8, to: 1.6, opacity: 0.6, curve: motion.easeOut });
  });

  it("turns the spinner once every 900 ms", () => {
    expect(on().spin).toBe(900);
  });

  it("returns null with reduce motion", () => {
    expect(offlineMotion(true)).toBeNull();
  });
});
