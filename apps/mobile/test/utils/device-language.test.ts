// apps/mobile/test/utils/device-language.test.ts
//
// Tests for the device language reader.
//
// Tested:
// - deviceLanguage returns the first locale's tag unless it is English or unreadable
//
// What is covered:
// - Normal case, empty case, edges
//
// Run with: pnpm exec jest apps/mobile/test/utils/device-language.test.ts
//
// SEE: apps/mobile/src/utils/device-language.ts

import { describe, expect, it } from "@jest/globals";

import { deviceLanguage } from "@/utils/device-language";

const locales =
  (...entries: { languageTag: string; languageCode: string | null }[]) =>
  () =>
    entries;

describe("deviceLanguage", () => {
  it("returns the first locale's tag", () => {
    expect(
      deviceLanguage(
        locales(
          { languageTag: "es-AR", languageCode: "es" },
          { languageTag: "en-US", languageCode: "en" },
        ),
      ),
    ).toBe("es-AR");
  });

  it("returns null for English", () => {
    expect(deviceLanguage(locales({ languageTag: "en-GB", languageCode: "en" }))).toBeNull();
  });

  it("returns null with no language code", () => {
    expect(deviceLanguage(locales({ languageTag: "und", languageCode: null }))).toBeNull();
  });

  it("returns null with no locales", () => {
    expect(deviceLanguage(locales())).toBeNull();
  });

  it("reads the device by default", () => {
    expect(() => deviceLanguage()).not.toThrow();
  });
});
