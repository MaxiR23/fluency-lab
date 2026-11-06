// apps/mobile/test/haptics/index.test.ts
//
// Tests of the wiring in the haptics module: what the adapters are given.
//
// Tested:
// - play("send") reaches the light impact of expo-haptics and play("tab") the selection
// - The setting is stored in the key-value store under the haptics item
//
// What is covered:
// - The one place that wires the libraries, which no other test reaches (jest.setup.js mocks
//   "@/haptics" for every other test file)
//
// Run with: pnpm exec jest apps/mobile/test/haptics/index.test.ts
//
// SEE: apps/mobile/src/haptics/index.ts

import { describe, expect, it, jest } from "@jest/globals";

import { haptics, hapticsSetting } from "@/haptics";

const mockImpact = jest.fn<(style: string) => Promise<void>>(async () => undefined);
const mockSelection = jest.fn<() => Promise<void>>(async () => undefined);
const mockGetItem = jest.fn<(key: string) => Promise<string | null>>(async () => "off");
const mockSetItem = jest.fn<(key: string, value: string) => Promise<void>>(async () => undefined);

jest.unmock("@/haptics");
jest.mock("expo-haptics", () => ({
  impactAsync: (style: string) => mockImpact(style),
  selectionAsync: () => mockSelection(),
  ImpactFeedbackStyle: { Light: "light" },
}));
jest.mock("expo-sqlite/kv-store", () => ({
  Storage: {
    getItem: (key: string) => mockGetItem(key),
    setItem: (key: string, value: string) => mockSetItem(key, value),
  },
}));

describe("the haptics wiring", () => {
  it("plays a light impact for send and a selection for a tab", async () => {
    expect(await haptics.play("send")).toEqual({ ok: true, value: null });
    expect(mockImpact).toHaveBeenCalledWith("light");
    expect(await haptics.play("tab")).toEqual({ ok: true, value: null });
    expect(mockSelection).toHaveBeenCalledTimes(1);
  });

  it("reads and saves the setting in the key-value store", async () => {
    expect(await hapticsSetting.read()).toEqual({ ok: true, value: false });
    expect(mockGetItem).toHaveBeenCalledWith("haptics");
    await hapticsSetting.save(true);
    expect(mockSetItem).toHaveBeenCalledWith("haptics", "on");
  });
});
