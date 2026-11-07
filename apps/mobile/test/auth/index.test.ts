// apps/mobile/test/auth/index.test.ts
//
// Tests of the wiring in the auth module: what the Apple adapter is given.
//
// Tested:
// - The nonce digest asks expo-crypto for SHA-256 with hex output
// - The digest returns what expo-crypto gives
// - The Supabase url takes Metro's host in development; the env url is used as is without it
// - The client gets the request deadline fetch
//
// What is covered:
// - The one place that selects the algorithm and the encoding, which no other test reaches
//
// Run with: pnpm exec jest apps/mobile/test/auth/index.test.ts
//
// SEE: apps/mobile/src/auth/index.ts

import { afterEach, beforeEach, describe, expect, it, jest } from "@jest/globals";

import { generatedSecret } from "../helpers/generated-secret";
import { setDev } from "../helpers/set-dev";

const savedDev = __DEV__;

const mockDigest =
  jest.fn<(algorithm: string, value: string, options: object) => Promise<string>>();
const mockCreateClient = jest.fn<(url: string, key: string, options: object) => object>();
const mockDeadlineFetch = jest.fn();
let mockExpoConfig: { hostUri?: string } | null = null;
const mockCreateExpoApple =
  jest.fn<(options: { sha256Hex: (value: string) => Promise<string> }) => object>();

jest.mock("expo-sqlite/localStorage/install", () => ({}));
jest.mock("@supabase/supabase-js", () => ({
  createClient: (url: string, key: string, options: object) => mockCreateClient(url, key, options),
}));
jest.mock("expo-constants", () => ({
  __esModule: true,
  default: {
    get expoConfig() {
      return mockExpoConfig;
    },
  },
}));
jest.mock("expo-apple-authentication", () => ({
  AppleAuthenticationScope: { FULL_NAME: 0, EMAIL: 1 },
}));
jest.mock("expo-crypto", () => ({
  randomUUID: () => "id",
  CryptoDigestAlgorithm: { SHA256: "SHA-256", SHA512: "SHA-512" },
  CryptoEncoding: { HEX: "hex", BASE64: "base64" },
  digestStringAsync: (algorithm: string, value: string, options: object) =>
    mockDigest(algorithm, value, options),
}));
jest.mock("@/auth/supabase-auth", () => ({
  bindAutoRefresh: () => undefined,
  createSupabaseAuth: () => ({}),
  supabaseAuthOptions: () => ({}),
  withRequestDeadline: () => mockDeadlineFetch,
  SUPABASE_REQUEST_TIMEOUT_MS: 10000,
}));
jest.mock("@/auth/expo-apple", () => ({
  createExpoApple: (options: { sha256Hex: (value: string) => Promise<string> }) =>
    mockCreateExpoApple(options),
}));

function loadAuth() {
  process.env.EXPO_PUBLIC_SUPABASE_URL = "http://192.168.1.88:54321";
  process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY = generatedSecret("publishable");
  Object.defineProperty(globalThis, "localStorage", { value: {}, configurable: true });
  jest.requireActual("@/auth");
  const call = mockCreateClient.mock.calls[0];
  if (call === undefined) throw new Error("the client was not created");
  return call;
}

function loadSha256Hex() {
  process.env.EXPO_PUBLIC_SUPABASE_URL = "http://localhost:54321";
  process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY = generatedSecret("publishable");
  // The install module is mocked, so the storage it would define is stubbed.
  Object.defineProperty(globalThis, "localStorage", { value: {}, configurable: true });
  jest.requireActual("@/auth");
  const options = mockCreateExpoApple.mock.calls[0]?.[0];
  if (options === undefined) throw new Error("the Apple adapter was not created");
  return options.sha256Hex;
}

describe("auth wiring", () => {
  beforeEach(() => {
    jest.resetModules();
    mockDigest.mockReset();
    mockCreateExpoApple.mockReset();
    mockCreateClient.mockReset().mockReturnValue({ auth: {} });
    mockExpoConfig = null;
  });

  afterEach(() => setDev(savedDev));

  it("creates the client at Metro's host in development", () => {
    setDev(true);
    mockExpoConfig = { hostUri: "192.168.1.89:8081" };
    expect(loadAuth()[0]).toBe("http://192.168.1.89:54321");
  });

  it("creates the client at the env url when hostUri is missing", () => {
    setDev(true);
    mockExpoConfig = {};
    expect(loadAuth()[0]).toBe("http://192.168.1.88:54321");
  });

  it("creates the client at the env url outside development", () => {
    setDev(false);
    mockExpoConfig = { hostUri: "192.168.1.89:8081" };
    expect(loadAuth()[0]).toBe("http://192.168.1.88:54321");
  });

  it("gives the client the request deadline fetch", () => {
    expect(loadAuth()[2]).toEqual(
      expect.objectContaining({ global: { fetch: mockDeadlineFetch } }),
    );
  });

  it("digests the nonce with SHA-256 and hex output", async () => {
    mockDigest.mockResolvedValue("ab12");
    const sha256Hex = loadSha256Hex();
    await sha256Hex("raw-nonce");
    expect(mockDigest).toHaveBeenCalledWith("SHA-256", "raw-nonce", { encoding: "hex" });
  });

  it("returns the digest expo-crypto gives", async () => {
    mockDigest.mockResolvedValue("ab12");
    const sha256Hex = loadSha256Hex();
    await expect(sha256Hex("raw-nonce")).resolves.toBe("ab12");
  });
});
