export type AuthSession = {
  accessToken: string;
  user: { id: string; email: string | null };
};

export type AuthFailure =
  | "invalid_credentials"
  | "email_taken"
  | "weak_password"
  | "invalid_or_expired_code"
  | "network"
  | "unknown";

export type AuthOutcome<T> = { ok: true; value: T } | { ok: false; failure: AuthFailure };

// INFO: step "code" means nothing changed and the code can be retried.
// Step "password" means the code is spent: a new one must be requested.
export type PasswordResetOutcome =
  | { ok: true; value: AuthSession }
  | { ok: false; step: "code"; failure: AuthFailure }
  | { ok: false; step: "password"; failure: AuthFailure; stillSignedIn: boolean };

export type AuthPort = {
  signInWithEmail(input: { email: string; password: string }): Promise<AuthOutcome<AuthSession>>;
  // INFO: null means the account exists and no session was issued yet.
  signUpWithEmail(input: {
    email: string;
    password: string;
  }): Promise<AuthOutcome<AuthSession | null>>;
  requestPasswordReset(email: string): Promise<AuthOutcome<null>>;
  confirmPasswordReset(input: {
    email: string;
    code: string;
    newPassword: string;
  }): Promise<PasswordResetOutcome>;
  // INFO: nonce is the raw value; the hashed one is what goes to Apple.
  signInWithApple(input: { idToken: string; nonce: string }): Promise<AuthOutcome<AuthSession>>;
  signOut(): Promise<AuthOutcome<null>>;
  currentSession(): Promise<AuthOutcome<AuthSession | null>>;
  // INFO: returns the unsubscribe function. Fires at once with the current session.
  onSessionChange(listener: (session: AuthSession | null) => void): () => void;
};
