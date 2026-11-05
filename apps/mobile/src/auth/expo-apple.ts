import type {
  AppleCredentialOutcome,
  AppleFullName,
  ApplePort,
  AuthOutcome,
} from "@/auth/auth-port";
import { createAppleNonce } from "@/utils/apple-sign-in";

function isCancel(thrown: unknown): boolean {
  return (
    typeof thrown === "object" &&
    thrown !== null &&
    "code" in thrown &&
    thrown.code === "ERR_REQUEST_CANCELED"
  );
}

export function createExpoApple<Scope>(deps: {
  lib: {
    isAvailableAsync(): Promise<boolean>;
    signInAsync(o: { requestedScopes: Scope[]; nonce: string }): Promise<{
      identityToken: string | null;
      fullName: AppleFullName | null;
    }>;
  };
  scopes: Scope[];
  randomId: () => string;
  sha256Hex: (value: string) => Promise<string>;
}): ApplePort {
  async function isAvailable(): Promise<AuthOutcome<boolean>> {
    try {
      return { ok: true, value: await deps.lib.isAvailableAsync() };
    } catch {
      // INFO: a rejected check reaches the screen as a typed failure, which hides the button.
      return { ok: false, failure: "apple_request_failed" };
    }
  }

  async function requestCredential(): Promise<AppleCredentialOutcome> {
    try {
      const nonce = await createAppleNonce(deps);
      const result = await deps.lib.signInAsync({
        requestedScopes: deps.scopes,
        nonce: nonce.hashed,
      });
      if (result.identityToken === null) return { ok: false, failure: "apple_request_failed" };
      return {
        ok: true,
        value: { idToken: result.identityToken, rawNonce: nonce.raw, fullName: result.fullName },
      };
    } catch (thrown) {
      // INFO: a cancel is the user's choice, so it is its own outcome and not a failure.
      if (isCancel(thrown)) return { ok: false, failure: "canceled" };
      return { ok: false, failure: "apple_request_failed" };
    }
  }

  return { isAvailable, requestCredential };
}
