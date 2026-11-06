// Test helper (not a test file): a fake of the key port, so no test touches
// the native secure store. Wire it with
// jest.mock("@/keys", () => ({ keys: fake.fakeKeys })), where fake is
// jest.requireActual of this file. Call resetFakeKeys() in beforeEach.

import { jest } from "@jest/globals";

import type { KeyPort } from "@/keys/key-port";

export const fakeKeys = {
  saveApiKey: jest.fn<KeyPort["saveApiKey"]>(),
  deleteApiKey: jest.fn<KeyPort["deleteApiKey"]>(),
  hasApiKey: jest.fn<KeyPort["hasApiKey"]>(),
} satisfies KeyPort;

export function resetFakeKeys(): void {
  fakeKeys.saveApiKey.mockReset();
  fakeKeys.saveApiKey.mockResolvedValue({ ok: true, value: null });
  fakeKeys.deleteApiKey.mockReset();
  fakeKeys.deleteApiKey.mockResolvedValue({ ok: true, value: null });
  fakeKeys.hasApiKey.mockReset();
  fakeKeys.hasApiKey.mockResolvedValue({ ok: true, value: false });
}
