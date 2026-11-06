// Test helper (not a test file): a fake of the haptics ports, so no test reaches the native
// library or the device storage. jest.setup.js mocks "@/haptics" with it for every test file;
// test/haptics/index.test.ts unmocks it. resetFakeHaptics() runs before each test: the
// setting reads as on, and saving and playing succeed.

import { jest } from "@jest/globals";

import type { HapticsPort, HapticsSettingPort } from "@/haptics/haptics-port";

export const fakeHaptics = {
  play: jest.fn<HapticsPort["play"]>(),
} satisfies HapticsPort;

export const fakeHapticsSetting = {
  read: jest.fn<HapticsSettingPort["read"]>(),
  save: jest.fn<HapticsSettingPort["save"]>(),
} satisfies HapticsSettingPort;

export function resetFakeHaptics(): void {
  fakeHaptics.play.mockReset();
  fakeHaptics.play.mockResolvedValue({ ok: true, value: null });
  fakeHapticsSetting.read.mockReset();
  fakeHapticsSetting.read.mockResolvedValue({ ok: true, value: true });
  fakeHapticsSetting.save.mockReset();
  fakeHapticsSetting.save.mockResolvedValue({ ok: true, value: null });
}
