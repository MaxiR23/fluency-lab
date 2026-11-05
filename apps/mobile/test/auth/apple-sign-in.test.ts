// apps/mobile/test/auth/apple-sign-in.test.ts
//
// Tests for the Apple sign in flow over faked ports.
//
// Tested:
// - Credential, then sign in with the raw nonce, then the name
// - A cancel, an Apple failure, a sign in failure and a name failure
//
// What is covered:
// - Normal case, empty case, edges
//
// Run with: pnpm exec jest apps/mobile/test/auth/apple-sign-in.test.ts
//
// SEE: apps/mobile/src/auth/apple-sign-in.ts

import { beforeEach, describe, expect, it } from "@jest/globals";

import { runAppleSignIn } from "@/auth/apple-sign-in";
import type { AppleFullName } from "@/auth/auth-port";
import { fakeApple, fakeAuth, fakeSession, resetFakeAuth } from "../helpers/fake-auth";
import { generatedSecret } from "../helpers/generated-secret";

const idToken = generatedSecret("id-token");
const rawNonce = generatedSecret("nonce");

function credential(fullName: AppleFullName | null) {
  return { ok: true, value: { idToken, rawNonce, fullName } } as const;
}

beforeEach(() => {
  resetFakeAuth();
  fakeAuth.signInWithApple.mockResolvedValue({ ok: true, value: fakeSession() });
  fakeAuth.saveName.mockResolvedValue({ ok: true, value: null });
});

describe("runAppleSignIn", () => {
  it("signs in with the token and the raw nonce, then saves the name", async () => {
    fakeApple.requestCredential.mockResolvedValue(
      credential({ givenName: "Ada", familyName: "Lovelace" }),
    );

    expect(await runAppleSignIn({ apple: fakeApple, auth: fakeAuth })).toEqual({
      status: "signed_in",
    });
    expect(fakeAuth.signInWithApple).toHaveBeenCalledWith({ idToken, nonce: rawNonce });
    expect(fakeAuth.saveName).toHaveBeenCalledWith({
      fullName: "Ada Lovelace",
      givenName: "Ada",
      familyName: "Lovelace",
    });
  });

  it("signs in and saves nothing when the name is null", async () => {
    fakeApple.requestCredential.mockResolvedValue(credential(null));

    expect(await runAppleSignIn({ apple: fakeApple, auth: fakeAuth })).toEqual({
      status: "signed_in",
    });
    expect(fakeAuth.saveName).not.toHaveBeenCalled();
  });

  it("signs in and saves nothing when every part is blank", async () => {
    fakeApple.requestCredential.mockResolvedValue(credential({ givenName: " ", familyName: null }));

    expect(await runAppleSignIn({ apple: fakeApple, auth: fakeAuth })).toEqual({
      status: "signed_in",
    });
    expect(fakeAuth.saveName).not.toHaveBeenCalled();
  });

  it("returns canceled and does not call the auth port", async () => {
    fakeApple.requestCredential.mockResolvedValue({ ok: false, failure: "canceled" });

    expect(await runAppleSignIn({ apple: fakeApple, auth: fakeAuth })).toEqual({
      status: "canceled",
    });
    expect(fakeAuth.signInWithApple).not.toHaveBeenCalled();
    expect(fakeAuth.saveName).not.toHaveBeenCalled();
  });

  it("returns failed with the Apple failure and does not call the auth port", async () => {
    fakeApple.requestCredential.mockResolvedValue({ ok: false, failure: "apple_request_failed" });

    expect(await runAppleSignIn({ apple: fakeApple, auth: fakeAuth })).toEqual({
      status: "failed",
      failure: "apple_request_failed",
    });
    expect(fakeAuth.signInWithApple).not.toHaveBeenCalled();
  });

  it("returns failed with the sign-in failure and saves nothing", async () => {
    fakeApple.requestCredential.mockResolvedValue(
      credential({ givenName: "Ada", familyName: null }),
    );
    fakeAuth.signInWithApple.mockResolvedValue({ ok: false, failure: "network" });

    expect(await runAppleSignIn({ apple: fakeApple, auth: fakeAuth })).toEqual({
      status: "failed",
      failure: "network",
    });
    expect(fakeAuth.saveName).not.toHaveBeenCalled();
  });

  it("returns name_not_saved with the name and the failure when saving loses the network", async () => {
    fakeApple.requestCredential.mockResolvedValue(
      credential({ givenName: "Ada", familyName: null }),
    );
    fakeAuth.saveName.mockResolvedValue({ ok: false, failure: "network" });

    expect(await runAppleSignIn({ apple: fakeApple, auth: fakeAuth })).toEqual({
      status: "name_not_saved",
      failure: "network",
      name: { fullName: "Ada", givenName: "Ada", familyName: null },
    });
  });
});
