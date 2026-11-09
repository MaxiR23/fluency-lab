import type { AppleFullName, AuthOutcome, ProfileName } from "@/auth/auth-port";
import { hasText } from "@/utils/has-text";

export async function createAppleNonce(deps: {
  randomId: () => string;
  sha256Hex: (value: string) => Promise<string>;
}): Promise<{ raw: string; hashed: string }> {
  const raw = deps.randomId();
  return { raw, hashed: (await deps.sha256Hex(raw)).toLowerCase() };
}

function cleanPart(part: string | null): string | null {
  if (part === null || !hasText(part)) return null;
  return part.trim();
}

// INFO: a nameless credential has fullName present with every field null, so "only when
// Apple sends it" means at least one non-empty part.
export function appleProfileName(fullName: AppleFullName | null): ProfileName | null {
  if (fullName === null) return null;
  const givenName = cleanPart(fullName.givenName);
  const familyName = cleanPart(fullName.familyName);
  const parts = [givenName, familyName].filter((part) => part !== null);
  if (parts.length === 0) return null;
  return { fullName: parts.join(" "), givenName, familyName };
}

type ConfigExtra = { extra?: Record<string, unknown> } | null;

// INFO: app.config.ts sets extra.appleSignIn; only a literal true turns the button on,
// so a config with it false (the personal build sets extra.appleSignIn to false) hides it.
export function appleSignInConfigured(config: ConfigExtra): boolean {
  return config?.extra?.appleSignIn === true;
}

export function showsAppleSignIn(
  os: string,
  availability: AuthOutcome<boolean> | undefined,
  enabled: boolean,
): boolean {
  return (
    enabled && os === "ios" && availability !== undefined && availability.ok && availability.value
  );
}
