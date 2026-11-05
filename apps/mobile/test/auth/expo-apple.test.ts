// apps/mobile/test/auth/expo-apple.test.ts
//
// Tests for the Apple adapter of the Apple port, over an injected fake library.
//
// Tested:
// - isAvailable: true, false, a rejection
// - requestCredential: the hash goes to Apple, the raw nonce comes back
// - A cancel, any other Apple error, no token, a failing digest or random source
//
// What is covered:
// - Normal case, empty case, edges
//
// Run with: pnpm exec jest apps/mobile/test/auth/expo-apple.test.ts
//
// SEE: apps/mobile/src/auth/expo-apple.ts

import { describe, expect, it, jest } from "@jest/globals";

import { createExpoApple } from "@/auth/expo-apple";
import type { AppleFullName } from "@/auth/auth-port";
import { generatedSecret } from "../helpers/generated-secret";

type Result = { identityToken: string | null; fullName: AppleFullName | null };

const idToken = generatedSecret("id-token");
const rawNonce = generatedSecret("raw");

async function sha256Hex(value: string): Promise<string> {
  return `digest-of-${value}`;
}

function setup(overrides: {
  isAvailableAsync?: () => Promise<boolean>;
  signInAsync?: (o: { requestedScopes: string[]; nonce: string }) => Promise<Result>;
  randomId?: () => string;
  sha256Hex?: (value: string) => Promise<string>;
}) {
  const signInAsync = jest
    .fn<(o: { requestedScopes: string[]; nonce: string }) => Promise<Result>>()
    .mockImplementation(
      overrides.signInAsync ??
        (async () => ({
          identityToken: idToken,
          fullName: { givenName: "Ada", familyName: null },
        })),
    );
  const port = createExpoApple<string>({
    lib: { isAvailableAsync: overrides.isAvailableAsync ?? (async () => true), signInAsync },
    scopes: ["full", "email"],
    randomId: overrides.randomId ?? (() => rawNonce),
    sha256Hex: overrides.sha256Hex ?? sha256Hex,
  });
  return { port, signInAsync };
}

describe("isAvailable", () => {
  it("returns true when the device supports Apple sign-in", async () => {
    expect(await setup({}).port.isAvailable()).toEqual({ ok: true, value: true });
  });

  it("returns false, as a success, when the device does not", async () => {
    const { port } = setup({ isAvailableAsync: async () => false });
    expect(await port.isAvailable()).toEqual({ ok: true, value: false });
  });

  it("returns apple_request_failed instead of throwing when the check rejects", async () => {
    const { port } = setup({ isAvailableAsync: () => Promise.reject(new Error("boom")) });
    expect(await port.isAvailable()).toEqual({ ok: false, failure: "apple_request_failed" });
  });
});

describe("requestCredential", () => {
  it("sends the hash to Apple and returns the raw nonce, the token and the name", async () => {
    const { port, signInAsync } = setup({});

    const outcome = await port.requestCredential();

    const hashed = await sha256Hex(rawNonce);
    expect(hashed).not.toBe(rawNonce);
    expect(signInAsync).toHaveBeenCalledWith({ requestedScopes: ["full", "email"], nonce: hashed });
    expect(outcome).toEqual({
      ok: true,
      value: { idToken, rawNonce, fullName: { givenName: "Ada", familyName: null } },
    });
  });

  it("returns a null name, as a success, when Apple sends none", async () => {
    const { port } = setup({
      signInAsync: async () => ({ identityToken: idToken, fullName: null }),
    });
    expect(await port.requestCredential()).toEqual({
      ok: true,
      value: { idToken, rawNonce, fullName: null },
    });
  });

  it("returns canceled when the user cancels", async () => {
    const { port } = setup({
      signInAsync: () =>
        Promise.reject(Object.assign(new Error("x"), { code: "ERR_REQUEST_CANCELED" })),
    });
    expect(await port.requestCredential()).toEqual({ ok: false, failure: "canceled" });
  });

  it("returns apple_request_failed for any other Apple error code", async () => {
    const { port } = setup({
      signInAsync: () =>
        Promise.reject(Object.assign(new Error("x"), { code: "ERR_REQUEST_FAILED" })),
    });
    expect(await port.requestCredential()).toEqual({ ok: false, failure: "apple_request_failed" });
  });

  it("returns apple_request_failed when Apple returns no identity token", async () => {
    const { port } = setup({ signInAsync: async () => ({ identityToken: null, fullName: null }) });
    expect(await port.requestCredential()).toEqual({ ok: false, failure: "apple_request_failed" });
  });

  it("returns apple_request_failed when the digest rejects", async () => {
    const { port, signInAsync } = setup({ sha256Hex: () => Promise.reject(new Error("boom")) });
    expect(await port.requestCredential()).toEqual({ ok: false, failure: "apple_request_failed" });
    expect(signInAsync).not.toHaveBeenCalled();
  });

  it("returns apple_request_failed when the random source throws", async () => {
    const { port } = setup({
      randomId: () => {
        throw new Error("boom");
      },
    });
    expect(await port.requestCredential()).toEqual({ ok: false, failure: "apple_request_failed" });
  });
});
