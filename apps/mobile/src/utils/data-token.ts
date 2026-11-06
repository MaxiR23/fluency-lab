import type { AuthOutcome, AuthSession } from "@/auth/auth-port";

export type TokenRead =
  { ok: true; token: string } | { ok: false; failure: "unauthorized" | "network" | "unavailable" };

// INFO: a failed read is never reported as "signed out": only a read that
// succeeded with no session is unauthorized.
export function toTokenRead(outcome: AuthOutcome<AuthSession | null>): TokenRead {
  if (!outcome.ok) {
    return { ok: false, failure: outcome.failure === "network" ? "network" : "unavailable" };
  }
  if (outcome.value === null) return { ok: false, failure: "unauthorized" };
  return { ok: true, token: outcome.value.accessToken };
}
