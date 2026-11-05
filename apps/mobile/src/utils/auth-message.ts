import type { AuthFailure, PasswordResetOutcome } from "@/auth/auth-port";

const failureMessages: Record<AuthFailure, string> = {
  invalid_credentials: "That email or password is not right.",
  email_taken: "An account with this email already exists. Sign in instead.",
  weak_password: "That password is too weak. Try a longer one.",
  invalid_or_expired_code: "That code is wrong or has expired.",
  network: "Could not reach the server. Check your connection and try again.",
  // INFO: this also reads sensibly for the email rate limit, which maps here.
  unknown: "Something went wrong. Wait a moment and try again.",
};

export function authFailureMessage(failure: AuthFailure): string {
  return failureMessages[failure];
}

export type ResetFailureAction = "retry" | "request_new_code" | "continue";

export function resetFailureView(outcome: Extract<PasswordResetOutcome, { ok: false }>): {
  message: string;
  action: ResetFailureAction;
} {
  const message = authFailureMessage(outcome.failure);
  if (outcome.step === "code") {
    return { message, action: "retry" };
  }
  if (outcome.stillSignedIn) {
    return {
      message: `${message} Your password did not change, and you are still signed in.`,
      action: "continue",
    };
  }
  return {
    message: `${message} Your code was used, so request a new one.`,
    action: "request_new_code",
  };
}

// INFO: the server does not say whether the account exists, so neither do we.
export function resetCodeSentMessage(email: string): string {
  return `If an account exists for ${email}, we sent it a code.`;
}

export const signUpPendingMessage = "Check your email to confirm your account, then sign in.";
export const missingResetEmailMessage = "Request a code first.";

// INFO: while the request runs, and in the continue state, the only way out is
// Continue: any other exit would drop the screen that ends the reset hold.
export function blocksResetExit(running: boolean, action: ResetFailureAction): boolean {
  return running || action === "continue";
}
