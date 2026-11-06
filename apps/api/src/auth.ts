import type { MiddlewareHandler } from "hono";
import { jwk } from "hono/jwk";

export type Jwk = JsonWebKey & { kid?: string };
export type JwksOutcome =
  { ok: true; keys: Jwk[] } | { ok: false; reason: "unavailable" | "bad_body" };
export type AuthConfig = { issuer: string; loadKeys: () => Promise<JwksOutcome> };
export type TokenUser = { id: string; email: string | null };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isJwkList(value: unknown): value is Jwk[] {
  return Array.isArray(value) && value.every(isRecord);
}

export function requireAuth(config: AuthConfig): MiddlewareHandler {
  return jwk({
    alg: ["ES256"],
    keys: async () => {
      const outcome = await config.loadKeys();
      // INFO: must stay a plain Error. The middleware rethrows only when
      // constructor === Error, and turns any other failure into a 401.
      if (!outcome.ok) throw new Error(`jwks ${outcome.reason}`);
      return outcome.keys;
    },
    verification: { iss: config.issuer, aud: "authenticated" },
  });
}

const JWKS_TIMEOUT_MS = 5000;

export async function fetchJwks(
  url: string,
  fetchFn: typeof fetch,
  timeoutMs: number = JWKS_TIMEOUT_MS,
): Promise<JwksOutcome> {
  let response: Response;
  try {
    // INFO: a server that accepts and never answers must end as unavailable, not hang.
    response = await fetchFn(url, { signal: AbortSignal.timeout(timeoutMs) });
  } catch {
    return { ok: false, reason: "unavailable" };
  }
  if (!response.ok) return { ok: false, reason: "unavailable" };
  let body: unknown;
  try {
    body = await response.json();
  } catch {
    return { ok: false, reason: "bad_body" };
  }
  if (!isRecord(body) || !isJwkList(body.keys)) return { ok: false, reason: "bad_body" };
  return { ok: true, keys: body.keys };
}

export function readTokenUser(payload: unknown): TokenUser | null {
  if (!isRecord(payload)) return null;
  const { sub, email } = payload;
  if (typeof sub !== "string" || sub === "") return null;
  return { id: sub, email: typeof email === "string" && email !== "" ? email : null };
}

export function readBearerToken(header: string | undefined): string | null {
  if (header === undefined) return null;
  const match = /^bearer +(\S+)\s*$/i.exec(header);
  return match === null ? null : match[1];
}

export function authConfigFromEnv(
  env: Record<string, string | undefined>,
  fetchFn: typeof fetch,
): AuthConfig {
  const raw = env.SUPABASE_URL;
  if (raw === undefined || raw.trim() === "") throw new Error("Missing SUPABASE_URL");
  const base = raw.trim().replace(/\/$/, "");
  return {
    issuer: `${base}/auth/v1`,
    loadKeys: () => fetchJwks(`${base}/auth/v1/.well-known/jwks.json`, fetchFn),
  };
}
