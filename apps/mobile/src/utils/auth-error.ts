import type { AuthFailure, FailureCause } from "@/auth/auth-port";

// INFO: the Supabase docs say to identify errors by name and code, never by
// message, so message is not read.
export function toAuthFailure(error: unknown): AuthFailure {
  if (typeof error !== "object" || error === null) return "unknown";
  if ("name" in error && error.name === "AuthRetryableFetchError") return "network";
  if (!("code" in error)) return "unknown";
  switch (error.code) {
    case "invalid_credentials":
      return "invalid_credentials";
    case "user_already_exists":
    case "email_exists":
      return "email_taken";
    case "weak_password":
      return "weak_password";
    case "otp_expired":
      return "invalid_or_expired_code";
    default:
      return "unknown";
  }
}

const maxCauseDetailLength = 200;
const plainIdentifier = /^[A-Za-z_$][\w$]{0,63}$/;
const plainCode = /^[A-Za-z][A-Za-z0-9_]{0,63}$/;
const opaqueToken = /^(?=.*\d).{24,}$/;

// INFO: the order matters; bodies and URLs go first so later rules do not cut them in half.
export function redactCauseDetail(message: string): string | null {
  const redacted = message
    .replace(/\{[\s\S]*\}/g, "[body]")
    .replace(/\b(https?:\/\/)(?:[^\s/@]+@)?([^\s?#]*)[?#]?\S*/g, "$1$2")
    .replace(/\b(Bearer|Basic)\s+\S+/gi, "$1 [redacted]")
    .replace(
      /\b(new_password|newPassword|password|access_token|refresh_token|id_token|token|api_key|apikey|key|secret|nonce|code|authorization)\b(["']?\s*[:=]\s*)(?:"[^"]*"|'[^']*'|[^\s,;&]+)/gi,
      "$1$2[redacted]",
    )
    .replace(/[^\s@"'<>(),;:]+@[^\s@"'<>(),;:]+\.[^\s@"'<>(),;:]+/g, "[email]")
    .replace(/\beyJ[\w-]*\.[\w-]+\.[\w-]+/g, "[token]")
    .replace(/\bsb_(?:publishable|secret)_[\w-]+/g, "[key]")
    .replace(/\b(?=[\w-]*\d)[\w-]{24,}\b/g, "[redacted]")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxCauseDetailLength);
  return redacted === "" ? null : redacted;
}

// INFO: the code is held to a plain identifier so it cannot carry a token, email or body.
function safeCode(error: object): string | null {
  if (!("code" in error) || typeof error.code !== "string") return null;
  return plainCode.test(error.code) && !opaqueToken.test(error.code) ? error.code : null;
}

// INFO: only transport failures keep the message. An API error message can echo
// the request; the transport message comes from the network stack or a 5xx
// body, and is redacted anyway.
// The code is kept only when the caller asks, so Supabase causes stay as they are.
export function describeAuthCause(
  error: unknown,
  options: { code: boolean } = { code: false },
): FailureCause {
  if (typeof error !== "object" || error === null) return { name: "unknown", detail: null };
  const name =
    "name" in error && typeof error.name === "string" && plainIdentifier.test(error.name)
      ? error.name
      : "unknown";
  const detail =
    toAuthFailure(error) === "network" && "message" in error && typeof error.message === "string"
      ? redactCauseDetail(error.message)
      : null;
  const code = options.code ? safeCode(error) : null;
  return code === null ? { name, detail } : { name, detail, code };
}
