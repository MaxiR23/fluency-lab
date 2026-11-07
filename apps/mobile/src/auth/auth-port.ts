export type AuthSession = {
  accessToken: string;
  user: { id: string; email: string | null };
};

export type AuthFailure =
  | "invalid_credentials"
  | "email_taken"
  | "weak_password"
  | "invalid_or_expired_code"
  | "apple_request_failed"
  | "network"
  | "unknown";

// INFO: a safe description of what failed, for development only.
// detail is set only for transport failures and is already redacted.
// code is set only where the adapter asks for it (the Apple library), and only as a plain identifier.
export type FailureCause = { name: string; detail: string | null; code?: string };

export type AuthOutcome<T> =
  { ok: true; value: T } | { ok: false; failure: AuthFailure; cause?: FailureCause };

// INFO: step "code" means nothing changed and the code can be retried.
// Step "password" means the code is spent: a new one must be requested.
export type PasswordResetOutcome =
  | { ok: true; value: AuthSession }
  | { ok: false; step: "code"; failure: AuthFailure; cause?: FailureCause }
  | {
      ok: false;
      step: "password";
      failure: AuthFailure;
      cause?: FailureCause;
      stillSignedIn: boolean;
    };

export type AuthPort = {
  signInWithEmail(input: { email: string; password: string }): Promise<AuthOutcome<AuthSession>>;
  // INFO: null means the account exists and no session was issued yet.
  signUpWithEmail(input: {
    email: string;
    password: string;
    name: string;
  }): Promise<AuthOutcome<AuthSession | null>>;
  requestPasswordReset(email: string): Promise<AuthOutcome<null>>;
  confirmPasswordReset(input: {
    email: string;
    code: string;
    newPassword: string;
  }): Promise<PasswordResetOutcome>;
  // INFO: nonce is the raw value; the hashed one is what goes to Apple.
  signInWithApple(input: { idToken: string; nonce: string }): Promise<AuthOutcome<AuthSession>>;
  saveName(name: ProfileName): Promise<AuthOutcome<null>>;
  signOut(): Promise<AuthOutcome<null>>;
  currentSession(): Promise<AuthOutcome<AuthSession | null>>;
  // INFO: returns the unsubscribe function. Reports changes after launch; the session at launch comes from currentSession.
  onSessionChange(listener: (session: AuthSession | null) => void): () => void;
};

export type ProfileName = {
  fullName: string;
  givenName: string | null;
  familyName: string | null;
};
export type AppleFullName = { givenName: string | null; familyName: string | null };
// INFO: rawNonce is what goes to signInWithApple; its hash already went to Apple.
export type AppleCredential = {
  idToken: string;
  rawNonce: string;
  fullName: AppleFullName | null;
};
export type AppleCredentialOutcome =
  | { ok: true; value: AppleCredential }
  | { ok: false; failure: "canceled" }
  | { ok: false; failure: "apple_request_failed"; cause?: FailureCause };
export type ApplePort = {
  isAvailable(): Promise<AuthOutcome<boolean>>;
  requestCredential(): Promise<AppleCredentialOutcome>;
};
export type AppleSignInOutcome =
  | { status: "signed_in" }
  | { status: "canceled" }
  | { status: "failed"; failure: AuthFailure; cause?: FailureCause }
  | { status: "name_not_saved"; failure: AuthFailure; name: ProfileName; cause?: FailureCause };
