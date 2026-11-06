import type {
  ActiveSession,
  Message,
  MessageCreate,
  SessionWithMessages,
  Profile,
  ProfileUpdate,
  Session,
  TopicId,
} from "@fluency-lab/shared";

export type StoreFailure = "unauthorized" | "unavailable";
export type StoreOutcome<T> = { ok: true; value: T } | { ok: false; failure: StoreFailure };
export type Caller = { id: string; accessToken: string };

export type UserStore = {
  // INFO: creates the caller's row when it is missing (a user from before the profiles table).
  getProfile(): Promise<StoreOutcome<Profile>>;
  updateProfile(update: ProfileUpdate): Promise<StoreOutcome<Profile | null>>;
  getActiveSession(): Promise<StoreOutcome<ActiveSession | null>>;
  createSession(input: { topicId: TopicId | null; title: string }): Promise<StoreOutcome<Session>>;
  // INFO: null means the session is not visible to the caller (missing or another user's).
  getSessionWithMessages(sessionId: string): Promise<StoreOutcome<SessionWithMessages | null>>;
  addMessage(sessionId: string, input: MessageCreate): Promise<StoreOutcome<Message | null>>;
  addSessionCost(sessionId: string, amountUsd: number): Promise<StoreOutcome<Session | null>>;
  endSession(sessionId: string): Promise<StoreOutcome<Session | null>>;
  listSessionStarts(since: string): Promise<StoreOutcome<string[]>>;
  listSessionCostsSince(
    since: string,
  ): Promise<StoreOutcome<{ createdAt: string; costUsd: number }[]>>;
};

export type Store = { forUser(caller: Caller): UserStore };
