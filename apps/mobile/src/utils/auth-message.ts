import type {
  AppleSignInOutcome,
  AuthFailure,
  FailureCause,
  PasswordResetOutcome,
  ProfileName,
} from "@/auth/auth-port";

const failureMessages: Record<AuthFailure, string> = {
  invalid_credentials: "That email or password is not right.",
  email_taken: "An account with this email already exists. Sign in instead.",
  weak_password: "That password is too weak. Try a longer one.",
  invalid_or_expired_code: "That code is wrong or has expired.",
  apple_request_failed: "Apple could not sign you in. Try again.",
  network: "Could not reach the server. Check your connection and try again.",
  // INFO: this also reads sensibly for the email rate limit, which maps here.
  unknown: "Something went wrong. Wait a moment and try again.",
};

export function authFailureMessage(failure: AuthFailure): string {
  return failureMessages[failure];
}

export type FailureView = { message: string; cause?: FailureCause };

export function authFailureView(outcome: {
  failure: AuthFailure;
  cause?: FailureCause;
}): FailureView {
  return { message: authFailureMessage(outcome.failure), cause: outcome.cause };
}

// INFO: dev is a parameter so the production branch is testable; the component passes __DEV__.
export function failureCauseLine(cause: FailureCause | undefined, dev: boolean): string | null {
  if (!dev || cause === undefined) return null;
  return cause.detail === null ? cause.name : `${cause.name}: ${cause.detail}`;
}

export type ResetFailureAction = "retry" | "request_new_code" | "continue";

export function resetFailureView(outcome: Extract<PasswordResetOutcome, { ok: false }>): {
  message: string;
  action: ResetFailureAction;
  cause: FailureCause | undefined;
} {
  const message = authFailureMessage(outcome.failure);
  if (outcome.step === "code") {
    return { message, action: "retry", cause: outcome.cause };
  }
  if (outcome.stillSignedIn) {
    return {
      message: `${message} Your password did not change, and you are still signed in.`,
      action: "continue",
      cause: outcome.cause,
    };
  }
  return {
    message: `${message} Your code was used, so request a new one.`,
    action: "request_new_code",
    cause: outcome.cause,
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

export type AppleSignInView =
  | { kind: "none" }
  | { kind: "message"; message: string }
  | { kind: "name_not_saved"; message: string; name: ProfileName };

export function appleNameFailureMessage(failure: AuthFailure): string {
  return `${authFailureMessage(failure)} You are signed in, but your name was not saved.`;
}

// INFO: invalid_credentials is the email and password wording, which makes no
// sense after an Apple attempt, so it reads as the Apple failure.
function appleFailureMessage(failure: AuthFailure): string {
  return authFailureMessage(failure === "invalid_credentials" ? "apple_request_failed" : failure);
}

// INFO: a cancel is not a failure, so it draws nothing.
export function appleSignInView(outcome: AppleSignInOutcome): AppleSignInView {
  switch (outcome.status) {
    case "signed_in":
    case "canceled":
      return { kind: "none" };
    case "failed":
      return { kind: "message", message: appleFailureMessage(outcome.failure) };
    case "name_not_saved":
      return {
        kind: "name_not_saved",
        message: appleNameFailureMessage(outcome.failure),
        name: outcome.name,
      };
  }
}
