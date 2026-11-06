// Test helper (not a test file): a fake of the data port, so no test builds a
// URL or reaches the backend. Wire it with
// jest.mock("@/data", () => ({ data: fake.fakeData })), where fake is
// jest.requireActual of this file. Call resetFakeData() in beforeEach: it makes
// getProfile answer with a completed profile, so a signed in user lands on Home.

import { jest } from "@jest/globals";
import type { Profile } from "@fluency-lab/shared";

import type { DataPort } from "@/data/data-port";

export const fakeData = {
  getProfile: jest.fn<DataPort["getProfile"]>(),
  updateProfile: jest.fn<DataPort["updateProfile"]>(),
  getActiveSession: jest.fn<DataPort["getActiveSession"]>(),
  createSession: jest.fn<DataPort["createSession"]>(),
  listMessages: jest.fn<DataPort["listMessages"]>(),
} satisfies DataPort;

export function profileWith(overrides: Partial<Profile>): Profile {
  return {
    id: "user-1",
    displayName: null,
    level: null,
    goals: [],
    topics: [],
    provider: null,
    monthlyLimitUsd: null,
    onboardingCompletedAt: null,
    createdAt: "2026-11-05T09:00:00Z",
    updatedAt: "2026-11-05T09:00:00Z",
    ...overrides,
  };
}

export function completedProfile(): Profile {
  return profileWith({ onboardingCompletedAt: "2026-11-05T10:00:00Z" });
}

export function resetFakeData(): void {
  for (const fn of Object.values(fakeData)) {
    fn.mockReset();
  }
  fakeData.getProfile.mockResolvedValue({ ok: true, value: completedProfile() });
}
