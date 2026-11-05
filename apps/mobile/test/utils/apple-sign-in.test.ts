// apps/mobile/test/utils/apple-sign-in.test.ts
//
// Tests for the pure Apple sign in rules.
//
// Tested:
// - The nonce: raw value and its SHA-256 hex
// - Which part of Apple's full name becomes the profile name
// - When the Apple button shows
//
// What is covered:
// - Normal case, empty case, edges
//
// Run with: pnpm exec jest apps/mobile/test/utils/apple-sign-in.test.ts
//
// SEE: apps/mobile/src/utils/apple-sign-in.ts

import { describe, expect, it, jest } from "@jest/globals";

import { appleProfileName, createAppleNonce, showsAppleSignIn } from "@/utils/apple-sign-in";

const sha256OfAbc = "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad";
const sha256OfEmpty = "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855";

// INFO: the app has no Node types, so the digest is a table of published vectors.
const vectors: Record<string, string> = { abc: sha256OfAbc, "": sha256OfEmpty };

async function sha256Hex(value: string): Promise<string> {
  return vectors[value] ?? `digest-of-${value}`;
}

describe("createAppleNonce", () => {
  it("returns the raw value and its SHA-256 as hex", async () => {
    expect(await createAppleNonce({ randomId: () => "abc", sha256Hex })).toEqual({
      raw: "abc",
      hashed: sha256OfAbc,
    });
  });

  it("hashes the same value it returns as raw", async () => {
    const sha256 = jest.fn(sha256Hex);
    const nonce = await createAppleNonce({ randomId: () => "abc", sha256Hex: sha256 });
    expect(sha256).toHaveBeenCalledWith(nonce.raw);
  });

  it("hashes an empty raw value to the SHA-256 of the empty string", async () => {
    expect((await createAppleNonce({ randomId: () => "", sha256Hex })).hashed).toBe(sha256OfEmpty);
  });

  it("lowercases a digest that comes in uppercase", async () => {
    const nonce = await createAppleNonce({
      randomId: () => "abc",
      sha256Hex: async (value) => (await sha256Hex(value)).toUpperCase(),
    });
    expect(nonce.hashed).toBe(sha256OfAbc);
  });

  it("asks the random source for a new value on each call", async () => {
    let n = 0;
    const deps = { randomId: () => `id-${(n += 1)}`, sha256Hex };
    const first = await createAppleNonce(deps);
    const second = await createAppleNonce(deps);
    expect(first.raw).not.toBe(second.raw);
    expect(first.hashed).not.toBe(second.hashed);
  });

  it("passes on a rejection of the digest", async () => {
    await expect(
      createAppleNonce({
        randomId: () => "abc",
        sha256Hex: () => Promise.reject(new Error("boom")),
      }),
    ).rejects.toThrow("boom");
  });
});

describe("appleProfileName", () => {
  it("joins the given and family names with a space", () => {
    expect(appleProfileName({ givenName: "Ada", familyName: "Lovelace" })).toEqual({
      fullName: "Ada Lovelace",
      givenName: "Ada",
      familyName: "Lovelace",
    });
  });

  it("returns null when fullName is null", () => {
    expect(appleProfileName(null)).toBeNull();
  });

  it("returns null when every field is null", () => {
    expect(appleProfileName({ givenName: null, familyName: null })).toBeNull();
  });

  it("returns null when the parts are empty or only spaces", () => {
    expect(appleProfileName({ givenName: "", familyName: "   " })).toBeNull();
  });

  it("keeps a given name alone, with a null family name", () => {
    expect(appleProfileName({ givenName: "Ada", familyName: null })).toEqual({
      fullName: "Ada",
      givenName: "Ada",
      familyName: null,
    });
  });

  it("keeps a family name alone, with a null given name", () => {
    expect(appleProfileName({ givenName: null, familyName: "Lovelace" })).toEqual({
      fullName: "Lovelace",
      givenName: null,
      familyName: "Lovelace",
    });
  });

  it("trims each part", () => {
    expect(appleProfileName({ givenName: " Ada ", familyName: " Lovelace\n" })).toEqual({
      fullName: "Ada Lovelace",
      givenName: "Ada",
      familyName: "Lovelace",
    });
  });

  it("returns null when only a middle name or nickname came", () => {
    const credentialName = { givenName: null, familyName: null, middleName: "May", nickname: "A" };
    expect(appleProfileName(credentialName)).toBeNull();
  });
});

describe("showsAppleSignIn", () => {
  const available = { ok: true, value: true } as const;

  it("is true on iOS when available", () => {
    expect(showsAppleSignIn("ios", available)).toBe(true);
  });

  it("is false on iOS while the check has not returned", () => {
    expect(showsAppleSignIn("ios", undefined)).toBe(false);
  });

  it("is false on iOS when not available", () => {
    expect(showsAppleSignIn("ios", { ok: true, value: false })).toBe(false);
  });

  it("is false on iOS when the check failed", () => {
    expect(showsAppleSignIn("ios", { ok: false, failure: "apple_request_failed" })).toBe(false);
  });

  it("is false on Android even when the check says available", () => {
    expect(showsAppleSignIn("android", available)).toBe(false);
  });

  it("is false on web even when the check says available", () => {
    expect(showsAppleSignIn("web", available)).toBe(false);
  });
});
