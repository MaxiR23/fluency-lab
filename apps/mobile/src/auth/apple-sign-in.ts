import type { AppleSignInOutcome, ApplePort, AuthPort } from "@/auth/auth-port";
import { appleProfileName } from "@/utils/apple-sign-in";

export async function runAppleSignIn(ports: {
  apple: Pick<ApplePort, "requestCredential">;
  auth: Pick<AuthPort, "signInWithApple" | "saveName">;
}): Promise<AppleSignInOutcome> {
  const credential = await ports.apple.requestCredential();
  if (!credential.ok) {
    if (credential.failure === "canceled") return { status: "canceled" };
    return { status: "failed", failure: credential.failure, cause: credential.cause };
  }
  const { idToken, rawNonce, fullName } = credential.value;
  const signedIn = await ports.auth.signInWithApple({ idToken, nonce: rawNonce });
  if (!signedIn.ok) return { status: "failed", failure: signedIn.failure, cause: signedIn.cause };
  const name = appleProfileName(fullName);
  if (name === null) return { status: "signed_in" };
  const saved = await ports.auth.saveName(name);
  if (!saved.ok) return { status: "name_not_saved", failure: saved.failure, name };
  return { status: "signed_in" };
}
