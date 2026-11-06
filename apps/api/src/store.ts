import type {
  ActiveSession,
  Message,
  Profile,
  ProfileUpdate,
  Session,
  TopicId,
} from "@fluency-lab/shared";

export type StoreFailure = "unauthorized" | "unavailable";
export type StoreOutcome<T> = { ok: true; value: T } | { ok: false; failure: StoreFailure };
export type Caller = { id: string; accessToken: string };

export type UserStore = {
  getProfile(): Promise<StoreOutcome<Profile | null>>;
  updateProfile(update: ProfileUpdate): Promise<StoreOutcome<Profile | null>>;
  getActiveSession(): Promise<StoreOutcome<ActiveSession | null>>;
  createSession(input: { topicId: TopicId | null; title: string }): Promise<StoreOutcome<Session>>;
  // INFO: null means the session is not visible to the caller (missing or another user's).
  listMessages(sessionId: string): Promise<StoreOutcome<Message[] | null>>;
};

export type Store = { forUser(caller: Caller): UserStore };
