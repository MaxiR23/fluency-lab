// apps/mobile/test/utils/note-motion.test.ts
//
// Tests for the motion of the note screen's rows.
//
// Tested:
// - noteMotion gives the row motion of note.html, or none with reduce motion on
// - rowMotion delays each row 150 ms after the one before, from 100 ms
//
// What is covered:
// - Normal case, reduce motion, edges
//
// Run with: pnpm exec jest apps/mobile/test/utils/note-motion.test.ts
//
// SEE: apps/mobile/src/utils/note-motion.ts

import { describe, expect, it } from "@jest/globals";

import { noteMotion, rowMotion } from "@/utils/note-motion";

describe("noteMotion", () => {
  it("gives the row motion of the design", () => {
    expect(noteMotion(false)).toEqual({ duration: 840, delay: 100, stagger: 150, offset: -10 });
  });

  it("gives none with reduce motion on", () => {
    expect(noteMotion(true)).toBeNull();
  });
});

describe("rowMotion", () => {
  const motion = noteMotion(false);

  it("delays the rows 100, 250 and 400 ms and keeps the duration and the offset", () => {
    expect([0, 1, 2].map((index) => rowMotion(motion, index)?.delay)).toEqual([100, 250, 400]);
    expect(rowMotion(motion, 1)).toEqual({ duration: 840, delay: 250, offset: -10 });
  });

  it("treats a negative index as the first row", () => {
    expect(rowMotion(motion, -3)?.delay).toBe(100);
  });

  it("gives none with no motion", () => {
    expect(rowMotion(null, 0)).toBeNull();
  });
});
