export type FieldErrors = { email?: string; password?: string; code?: string };

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function normalizeEmail(email: string): string {
  return email.trim();
}

function emailError(email: string): string | undefined {
  const trimmed = normalizeEmail(email);
  if (trimmed === "") return "Enter your email.";
  if (!emailPattern.test(trimmed)) return "Enter a valid email.";
  return undefined;
}

function withoutUndefined(errors: FieldErrors): FieldErrors {
  return Object.fromEntries(
    Object.entries(errors).filter(([, message]) => message !== undefined),
  ) as FieldErrors;
}

// INFO: there is no length rule for the password: the server owns it and
// answers weak_password. A password of only spaces is the server's call too.
export function validateCredentials(input: { email: string; password: string }): FieldErrors {
  return withoutUndefined({
    email: emailError(input.email),
    password: input.password.length === 0 ? "Enter your password." : undefined,
  });
}

export function validateResetRequest(input: { email: string }): FieldErrors {
  return withoutUndefined({ email: emailError(input.email) });
}

// INFO: there is no code length rule: otp_length in supabase/config.toml owns it.
export function validateResetConfirm(input: { code: string; newPassword: string }): FieldErrors {
  return withoutUndefined({
    code: input.code.trim() === "" ? "Enter the code from the email." : undefined,
    password: input.newPassword.length === 0 ? "Enter a new password." : undefined,
  });
}

export function hasFieldErrors(errors: FieldErrors): boolean {
  return Object.keys(errors).length > 0;
}

export function readEmailParam(value: string | string[] | undefined): string | null {
  const first = Array.isArray(value) ? value[0] : value;
  if (first === undefined) return null;
  const trimmed = normalizeEmail(first);
  return trimmed === "" ? null : trimmed;
}
