import type {
  ActiveSession,
  CorrectionThread,
  Message,
  MessageCreate,
  SessionWithMessages,
  Profile,
  ProfileUpdate,
  Session,
  ThreadMessage,
  ThreadMessageCreate,
  ThreadReplies,
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
  // INFO: the caller's active sessions, newest first, each with its newest message.
  listOpenSessions(): Promise<StoreOutcome<ActiveSession[]>>;
  // INFO: null means the session is not visible to the caller (missing or another user's).
  deleteSession(sessionId: string): Promise<StoreOutcome<Session | null>>;
  createSession(input: { topicId: TopicId | null; title: string }): Promise<StoreOutcome<Session>>;
  // INFO: null means the session is not visible to the caller (missing or another user's).
  // The thread counts travel apart (listThreadCounts), so the main chat read never touches the thread table.
  getSessionWithMessages(
    sessionId: string,
  ): Promise<StoreOutcome<Omit<SessionWithMessages, "threadReplies"> | null>>;
  addMessage(sessionId: string, input: MessageCreate): Promise<StoreOutcome<Message | null>>;
  // INFO: null means the message is not visible to the caller (missing or another user's);
  // a message with no thread is the expected empty: messages is [].
  getThread(messageId: string): Promise<StoreOutcome<CorrectionThread | null>>;
  // INFO: null means the message is not visible to the caller (missing or another user's).
  addThreadMessage(
    messageId: string,
    input: ThreadMessageCreate,
  ): Promise<StoreOutcome<ThreadMessage | null>>;
  // INFO: item indexes are 0-based; null means the message is not the caller's.
  withdrawCorrections(messageId: string, items: number[]): Promise<StoreOutcome<Message | null>>;
  // INFO: the reply count of each message of the session that has a thread; [] is the expected empty.
  listThreadCounts(sessionId: string): Promise<StoreOutcome<ThreadReplies>>;
  addSessionCost(sessionId: string, amountUsd: number): Promise<StoreOutcome<Session | null>>;
  endSession(sessionId: string): Promise<StoreOutcome<Session | null>>;
  listSessionStarts(since: string): Promise<StoreOutcome<string[]>>;
  listSessionCostsSince(
    since: string,
  ): Promise<StoreOutcome<{ createdAt: string; costUsd: number }[]>>;
  // INFO: the profile numbers in one read. sessionDays are the distinct local dates
  // (in the given zone) with a session, newest first. Zeros and no days are the
  // expected empty: the user has no sessions yet.
  getStats(
    timeZone: string,
  ): Promise<StoreOutcome<{ sessionCount: number; sessionDays: string[]; newWords: number }>>;
  // INFO: the month's numbers in one read; zeros are the expected empty.
  getMonthProgress(
    timeZone: string,
    monthStart: string,
  ): Promise<StoreOutcome<{ sessionCount: number; correctionCount: number; newWordCount: number }>>;
  // INFO: ended sessions newest first, up to limit rows from offset; [] is the expected empty.
  listEndedSessions(
    offset: number,
    limit: number,
  ): Promise<StoreOutcome<{ session: Session; messageCount: number; correctionCount: number }[]>>;
  // INFO: mistakes grouped by rule (null for none), most frequent first, with the latest example.
  listMistakeGroups(
    offset: number,
    limit: number,
  ): Promise<
    StoreOutcome<{ rule: string | null; times: number; original: string; corrected: string }[]>
  >;
  // INFO: each new word once, at its first appearance, newest first, with its message text.
  listNewWords(
    offset: number,
    limit: number,
  ): Promise<StoreOutcome<{ word: string; sentence: string; createdAt: string }[]>>;
  // INFO: deletes the caller's auth user; their data goes with it through the
  // cascades. A user who is already gone is a success.
  deleteAccount(): Promise<StoreOutcome<null>>;
};

export type Store = { forUser(caller: Caller): UserStore };
