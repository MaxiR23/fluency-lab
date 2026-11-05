import type { AuthFailure } from "@/auth/auth-port";

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
