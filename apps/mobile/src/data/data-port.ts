import type {
  ActiveSession,
  Message,
  Profile,
  ProfileUpdate,
  Session,
  SessionCreate,
} from "@fluency-lab/shared";

export type DataFailure =
  "unauthorized" | "not_found" | "invalid_input" | "unavailable" | "network" | "bad_response";

export type DataOutcome<T> = { ok: true; value: T } | { ok: false; failure: DataFailure };

export type DataPort = {
  getProfile(): Promise<DataOutcome<Profile>>;
  updateProfile(input: ProfileUpdate): Promise<DataOutcome<Profile>>;
  // INFO: null is the expected empty: the user has no active session.
  getActiveSession(): Promise<DataOutcome<ActiveSession | null>>;
  createSession(input: SessionCreate): Promise<DataOutcome<Session>>;
  listMessages(sessionId: string): Promise<DataOutcome<Message[]>>;
};
