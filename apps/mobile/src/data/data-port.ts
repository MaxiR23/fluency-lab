import type {
  ActiveSession,
  CorrectionThread,
  HistoryPage,
  Message,
  MessageCreate,
  MistakePage,
  MonthProgress,
  MonthSpend,
  NotePage,
  PracticeAnswer,
  PracticeItem,
  PracticeCheckCreate,
  PracticeChecksSaved,
  PracticeItemCreate,
  PracticeRun,
  PracticeRunCreate,
  PracticeRunWithItems,
  RecentPrompt,
  Profile,
  ProfileStats,
  ProfileUpdate,
  Session,
  SessionCreate,
  SessionSummary,
  SessionContext,
  SessionTitleUpdate,
  SessionUsage,
  SessionWeek,
  SessionWithMessages,
  StudyNote,
  StudyNoteCreate,
  ThreadMessage,
  ThreadMessageCreate,
  WordPage,
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
  // INFO: saves the chat's summary of its older turns; the answer is the session as saved.
  setSessionContext(sessionId: string, input: SessionContext): Promise<DataOutcome<Session>>;
  // INFO: no expected empty: the session comes back with the title it keeps, or is not_found.
  setSessionTitle(sessionId: string, input: SessionTitleUpdate): Promise<DataOutcome<Session>>;
  endSession(sessionId: string): Promise<DataOutcome<Session>>;
  // INFO: no expected empty: a note exists or is not_found.
  createNote(input: StudyNoteCreate): Promise<DataOutcome<StudyNote>>;
  getNote(noteId: string): Promise<DataOutcome<StudyNote>>;
  deleteNote(noteId: string): Promise<DataOutcome<{ id: string }>>;
  // INFO: an empty page is the expected empty. Newest first; nextOffset is null on the last page;
  // today is the day the page was read, in the given zone.
  listNotes(timeZone: string, offset: number): Promise<DataOutcome<NotePage>>;
  // INFO: a thread with no messages is the expected empty: the learner has not asked yet.
  openThread(messageId: string): Promise<DataOutcome<CorrectionThread>>;
  addThreadMessage(
    messageId: string,
    input: ThreadMessageCreate,
  ): Promise<DataOutcome<ThreadMessage>>;
  // INFO: items are the 0-based indexes of the corrections to withdraw; the answer is the message as saved.
  withdrawCorrections(messageId: string, items: number[]): Promise<DataOutcome<Message>>;
  // INFO: 0 is the expected empty: nothing spent this month.
  getMonthSpend(timeZone: string): Promise<DataOutcome<MonthSpend>>;
  // INFO: a week with no days is the expected empty: no session this week.
  getSessionWeek(timeZone: string): Promise<DataOutcome<SessionWeek>>;
  // INFO: zeros are the expected empty: no sessions yet.
  getProfileStats(timeZone: string): Promise<DataOutcome<ProfileStats>>;
  // INFO: no corrections and no words are the expected empty.
  getSessionSummary(sessionId: string): Promise<DataOutcome<SessionSummary>>;
  // INFO: zeros are the expected empty: nothing this month.
  getMonthProgress(timeZone: string): Promise<DataOutcome<MonthProgress>>;
  // INFO: an empty page is the expected empty. Newest first; nextOffset is null on the last page.
  listHistory(timeZone: string, offset: number): Promise<DataOutcome<HistoryPage>>;
  // INFO: an empty page is the expected empty. Most frequent first; nextOffset is null on the last page.
  listMistakes(offset: number): Promise<DataOutcome<MistakePage>>;
  // INFO: an empty page is the expected empty. Newest first; nextOffset is null on the last page.
  listWords(timeZone: string, offset: number): Promise<DataOutcome<WordPage>>;
  // INFO: null is the expected empty: no practice was started today.
  getTodayPractice(timeZone: string): Promise<DataOutcome<PracticeRunWithItems | null>>;
  // INFO: [] is the expected empty: no practice in the last days.
  listRecentPrompts(days: number, limit: number): Promise<DataOutcome<RecentPrompt[]>>;
  createPracticeRun(input: PracticeRunCreate): Promise<DataOutcome<PracticeRun>>;
  // INFO: a run with no items is the expected empty: its first round has not been saved.
  openPracticeRun(runId: string): Promise<DataOutcome<PracticeRunWithItems>>;
  // INFO: saving a position twice is safe; the answer is every item of the run.
  addPracticeItems(
    runId: string,
    items: PracticeItemCreate[],
  ): Promise<DataOutcome<PracticeItem[]>>;
  // INFO: no expected empty: the app never sends zero rows.
  addPracticeChecks(
    runId: string,
    checks: PracticeCheckCreate[],
  ): Promise<DataOutcome<PracticeChecksSaved>>;
  answerPracticeItem(itemId: string, answer: PracticeAnswer): Promise<DataOutcome<PracticeItem>>;
  addPracticeUsage(runId: string, usage: SessionUsage): Promise<DataOutcome<PracticeRun>>;
  setPracticeTarget(runId: string, target: 10 | 15): Promise<DataOutcome<PracticeRun>>;
  finishPracticeRun(runId: string): Promise<DataOutcome<PracticeRun>>;
  // INFO: deletes the signed in user's account and data on the server; nothing is returned.
  deleteAccount(): Promise<DataOutcome<null>>;
};
