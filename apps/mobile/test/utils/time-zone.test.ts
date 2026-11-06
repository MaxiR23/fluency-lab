// apps/mobile/test/utils/time-zone.test.ts
//
// Tests for the device time zone reader.
//
// Tested:
// - deviceTimeZone returns the calendar zone, then the Intl zone, then UTC
//
// What is covered:
// - Normal case, empty case, edges
//
// Run with: pnpm exec jest apps/mobile/test/utils/time-zone.test.ts
//
// SEE: apps/mobile/src/utils/time-zone.ts

import { describe, expect, it } from "@jest/globals";

import { deviceTimeZone } from "@/utils/time-zone";

const BA = "America/Argentina/Buenos_Aires";
const noCalendars = () => [];
const calendar = (timeZone: string | null) => () => [{ timeZone }];

describe("deviceTimeZone", () => {
  it("prefers the calendar zone over Intl", () => {
    expect(deviceTimeZone(calendar(BA), () => "Europe/Madrid")).toBe(BA);
  });

  it("falls back to Intl when the calendar zone is null", () => {
    expect(deviceTimeZone(calendar(null), () => "Europe/Madrid")).toBe("Europe/Madrid");
  });

  it("falls back to Intl when the calendar zone is not an IANA name", () => {
    expect(deviceTimeZone(calendar("GMT+1"), () => "Europe/Madrid")).toBe("Europe/Madrid");
  });

  it("falls back to Intl when there are no calendars", () => {
    expect(deviceTimeZone(noCalendars, () => "Europe/Madrid")).toBe("Europe/Madrid");
  });

  it("falls back to UTC when neither source gives a zone", () => {
    expect(deviceTimeZone(noCalendars, () => undefined)).toBe("UTC");
    expect(deviceTimeZone(calendar(""), () => "")).toBe("UTC");
    expect(deviceTimeZone(calendar("GMT+1"), () => "GMT+1")).toBe("UTC");
  });

  it("accepts UTC as a zone", () => {
    expect(deviceTimeZone(calendar("UTC"), () => "Europe/Madrid")).toBe("UTC");
  });

  it("reads the runtime by default", () => {
    expect(deviceTimeZone().length).toBeGreaterThan(0);
  });
});
