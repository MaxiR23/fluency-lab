import type {
  ActiveSession,
  Message,
  MessageCreate,
  MonthSpend,
  Profile,
  ProfileUpdate,
  Session,
  SessionCreate,
  SessionUsage,
  SessionWeek,
  SessionWithMessages,
} from "@fluency-lab/shared";

export type DataFailure =
  "unauthorized" | "not_found" | "invalid_input" | "unavailable" | "network" | "bad_response";

export type DataOutcome<T> = { ok: true; value: T } | { ok: false; failure: DataFailure };

export type DataPort = {
  getProfile(): Promise<DataOutcome<Profile>>;
  updateProfile(input: ProfileUpdate): Promise<DataOutcome<Profile>>;
  // INFO: null is the expected empty: the user has no active session.
  getActiveSession(): Promise<DataOutcome<ActiveSession | null>>;
  // INFO: an empty list is the expected empty: no open session. Newest first.
  listOpenSessions(): Promise<DataOutcome<ActiveSession[]>>;
  deleteSession(sessionId: string): Promise<DataOutcome<Session>>;
  createSession(input: SessionCreate): Promise<DataOutcome<Session>>;
  openSession(sessionId: string): Promise<DataOutcome<SessionWithMessages>>;
  addMessage(sessionId: string, input: MessageCreate): Promise<DataOutcome<Message>>;
  addUsage(sessionId: string, usage: SessionUsage): Promise<DataOutcome<Session>>;
  endSession(sessionId: string): Promise<DataOutcome<Session>>;
  // INFO: 0 is the expected empty: nothing spent this month.
  getMonthSpend(timeZone: string): Promise<DataOutcome<MonthSpend>>;
  // INFO: a week with no days is the expected empty: no session this week.
  getSessionWeek(timeZone: string): Promise<DataOutcome<SessionWeek>>;
};
