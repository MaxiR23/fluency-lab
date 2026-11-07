// apps/mobile/test/data/index.test.ts
//
// Tests of the wiring in the data module: the API url it gives the adapter.
//
// Tested:
// - The API url takes Metro's host in development
// - The env url is used as is without hostUri or outside development
//
// What is covered:
// - Normal case, empty case, edges
//
// Run with: pnpm exec jest apps/mobile/test/data/index.test.ts
//
// SEE: apps/mobile/src/data/index.ts

import { afterEach, beforeEach, describe, expect, it, jest } from "@jest/globals";

import { setDev } from "../helpers/set-dev";

const savedDev = __DEV__;
const mockCreateHonoData = jest.fn<(config: { baseUrl: string }) => object>();
let mockExpoConfig: { hostUri?: string } | null = null;

jest.mock("@/auth", () => ({
  auth: jest.requireActual<typeof import("../helpers/fake-auth")>("../helpers/fake-auth").fakeAuth,
}));
jest.mock("@/data/hono-data", () => ({
  createHonoData: (config: { baseUrl: string }) => mockCreateHonoData(config),
}));
jest.mock("expo-constants", () => ({
  __esModule: true,
  default: {
    get expoConfig() {
      return mockExpoConfig;
    },
  },
}));

function loadBaseUrl(): string {
  process.env.EXPO_PUBLIC_API_URL = "http://192.168.1.88:3000";
  jest.requireActual("@/data");
  const config = mockCreateHonoData.mock.calls[0]?.[0];
  if (config === undefined) throw new Error("the data adapter was not created");
  return config.baseUrl;
}

describe("data wiring", () => {
  beforeEach(() => {
    jest.resetModules();
    mockCreateHonoData.mockReset().mockReturnValue({});
    mockExpoConfig = null;
  });

  afterEach(() => setDev(savedDev));

  it("gives the adapter Metro's host in development", () => {
    setDev(true);
    mockExpoConfig = { hostUri: "192.168.1.89:8081" };
    expect(loadBaseUrl()).toBe("http://192.168.1.89:3000");
  });

  it("gives the adapter the env url when hostUri is missing", () => {
    setDev(true);
    mockExpoConfig = {};
    expect(loadBaseUrl()).toBe("http://192.168.1.88:3000");
  });

  it("gives the adapter the env url outside development", () => {
    setDev(false);
    mockExpoConfig = { hostUri: "192.168.1.89:8081" };
    expect(loadBaseUrl()).toBe("http://192.168.1.88:3000");
  });
});
