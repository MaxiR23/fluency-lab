// apps/mobile/test/utils/deadline.test.ts
//
// Tests for the deadline shared by the data and AI adapters.
//
// Tested:
// - Work that settles before the deadline returns its value
// - Work that never settles returns DEADLINE and aborts the signal
// - Work that rejects rethrows
// - The timer is cleared after the work settles
//
// What is covered:
// - Normal case, edges
//
// Run with: pnpm exec jest apps/mobile/test/utils/deadline.test.ts
//
// SEE: apps/mobile/src/utils/deadline.ts

import { afterEach, beforeEach, describe, expect, it, jest } from "@jest/globals";

import { DEADLINE, withinDeadline } from "@/utils/deadline";

beforeEach(() => {
  jest.useFakeTimers();
});

afterEach(() => {
  jest.useRealTimers();
});

describe("withinDeadline", () => {
  it("returns the value of work that settles before the deadline", async () => {
    expect(await withinDeadline(1000, async () => "done")).toBe("done");
  });

  it("returns DEADLINE and aborts the signal when the work never settles", async () => {
    let seen: AbortSignal | undefined;
    const pending = withinDeadline(1000, (signal) => {
      seen = signal;
      return new Promise<string>(() => {});
    });

    jest.advanceTimersByTime(1000);

    expect(await pending).toBe(DEADLINE);
    expect(seen?.aborted).toBe(true);
  });

  it("rethrows when the work rejects", async () => {
    await expect(
      withinDeadline(1000, async () => {
        throw new TypeError("down");
      }),
    ).rejects.toThrow("down");
  });

  it("clears the timer after the work settles", async () => {
    await withinDeadline(1000, async () => "done");

    expect(jest.getTimerCount()).toBe(0);
  });

  it("clears the timer after the work rejects", async () => {
    await expect(
      withinDeadline(1000, async () => {
        throw new Error("x");
      }),
    ).rejects.toThrow("x");

    expect(jest.getTimerCount()).toBe(0);
  });
});
