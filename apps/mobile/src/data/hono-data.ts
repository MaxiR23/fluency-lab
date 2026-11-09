import {
  type Profile,
  type ProfileUpdate,
  accountDeletedSchema,
  activeSessionResponseSchema,
  correctionThreadSchema,
  historyPageSchema,
  mistakePageSchema,
  monthProgressSchema,
  messageSchema,
  monthSpendSchema,
  noteDeletedSchema,
  notePageSchema,
  openSessionsResponseSchema,
  practiceItemSchema,
  practiceItemsResponseSchema,
  practiceRunSchema,
  practiceRunWithItemsSchema,
  practiceTodaySchema,
  recentPromptsSchema,
  profileSchema,
  profileStatsSchema,
  sessionMessagesResponseSchema,
  sessionSchema,
  sessionSummarySchema,
  sessionWeekSchema,
  studyNoteSchema,
  threadMessageSchema,
  wordPageSchema,
} from "@fluency-lab/shared";
// INFO: type-only, so Metro never bundles the server.
import type { AppType } from "api";
import { hc } from "hono/client";

import type { DataFailure, DataOutcome, DataPort } from "@/data/data-port";
import { toDataFailure } from "@/utils/data-error";
import { DEADLINE, withinDeadline } from "@/utils/deadline";
import type { TokenRead } from "@/utils/data-token";

type Client = ReturnType<typeof hc<AppType>>;
// INFO: the part of the response the adapter reads; ClientResponse is not a DOM Response under the app's types.
type Res = { ok: boolean; status: number; json(): Promise<unknown> };
type Parser<T> = { safeParse(value: unknown): { success: true; data: T } | { success: false } };

export type HonoDataConfig = {
  baseUrl: string;
  fetchFn: typeof fetch;
  readToken: () => Promise<TokenRead>;
  timeoutMs?: number;
};

const DEFAULT_TIMEOUT_MS = 10000;

export function createHonoData(config: HonoDataConfig): DataPort {
  const timeoutMs = config.timeoutMs ?? DEFAULT_TIMEOUT_MS;

  async function call<T>(
    send: (client: Client) => Promise<Res>,
    parser: Parser<T>,
  ): Promise<DataOutcome<T>> {
    type Read =
      | { kind: "token"; failure: DataFailure }
      | { kind: "status"; status: number }
      | { kind: "body"; body: unknown }
      | { kind: "bad" };
    let read: Read | typeof DEADLINE;
    try {
      read = await withinDeadline<Read>(timeoutMs, async (signal) => {
        const token = await config.readToken();
        if (!token.ok) return { kind: "token", failure: token.failure };
        const client = hc<AppType>(config.baseUrl, {
          fetch: ((input, init) => config.fetchFn(input, { ...init, signal })) as typeof fetch,
          headers: { Authorization: `Bearer ${token.token}` },
        });
        const res = await send(client);
        if (!res.ok) return { kind: "status", status: res.status };
        try {
          return { kind: "body", body: await res.json() };
        } catch {
          return { kind: "bad" };
        }
      });
    } catch {
      return { ok: false, failure: "network" };
    }
    if (read === DEADLINE) return { ok: false, failure: "network" };
    if (read.kind === "token") return { ok: false, failure: read.failure };
    if (read.kind === "status") return { ok: false, failure: toDataFailure(read.status) };
    if (read.kind === "bad") return { ok: false, failure: "bad_response" };
    const parsed = parser.safeParse(read.body);
    return parsed.success
      ? { ok: true, value: parsed.data }
      : { ok: false, failure: "bad_response" };
  }

  return {
    getProfile: () => call((client) => client.profile.$get(), profileSchema),
    updateProfile: (input: ProfileUpdate) =>
      call<Profile>((client) => client.profile.$put({ json: input }), profileSchema),
    async getActiveSession() {
      const outcome = await call(
        (client) => client.sessions.active.$get(),
        activeSessionResponseSchema,
      );
      return outcome.ok ? { ok: true, value: outcome.value.activeSession } : outcome;
    },
    async listOpenSessions() {
      const outcome = await call(
        (client) => client.sessions.open.$get(),
        openSessionsResponseSchema,
      );
      return outcome.ok ? { ok: true, value: outcome.value.sessions } : outcome;
    },
    deleteSession: (sessionId) =>
      call((client) => client.sessions[":id"].$delete({ param: { id: sessionId } }), sessionSchema),
    createSession: (input) =>
      call((client) => client.sessions.$post({ json: input }), sessionSchema),
    getSessionWeek: (timeZone) =>
      call((client) => client.sessions.week.$get({ query: { tz: timeZone } }), sessionWeekSchema),
    openSession: (sessionId) =>
      call(
        (client) => client.sessions[":id"].messages.$get({ param: { id: sessionId } }),
        sessionMessagesResponseSchema,
      ),
    addMessage: (sessionId, input) =>
      call(
        (client) =>
          client.sessions[":id"].messages.$post({ param: { id: sessionId }, json: input }),
        messageSchema,
      ),
    addUsage: (sessionId, usage) =>
      call(
        (client) => client.sessions[":id"].usage.$post({ param: { id: sessionId }, json: usage }),
        sessionSchema,
      ),
    setSessionContext: (sessionId, input) =>
      call(
        (client) =>
          client.sessions[":id"].context.$patch({ param: { id: sessionId }, json: input }),
        sessionSchema,
      ),
    setSessionTitle: (sessionId, input) =>
      call(
        (client) => client.sessions[":id"].title.$patch({ param: { id: sessionId }, json: input }),
        sessionSchema,
      ),
    endSession: (sessionId) =>
      call(
        (client) => client.sessions[":id"].end.$post({ param: { id: sessionId } }),
        sessionSchema,
      ),
    createNote: (input) => call((client) => client.notes.$post({ json: input }), studyNoteSchema),
    getNote: (noteId) =>
      call((client) => client.notes[":id"].$get({ param: { id: noteId } }), studyNoteSchema),
    deleteNote: (noteId) =>
      call((client) => client.notes[":id"].$delete({ param: { id: noteId } }), noteDeletedSchema),
    listNotes: (timeZone, offset) =>
      call(
        (client) => client.progress.notes.$get({ query: { tz: timeZone, offset: String(offset) } }),
        notePageSchema,
      ),
    openThread: (messageId) =>
      call(
        (client) => client.messages[":id"].thread.$get({ param: { id: messageId } }),
        correctionThreadSchema,
      ),
    addThreadMessage: (messageId, input) =>
      call(
        (client) => client.messages[":id"].thread.$post({ param: { id: messageId }, json: input }),
        threadMessageSchema,
      ),
    withdrawCorrections: (messageId, items) =>
      call(
        (client) =>
          client.messages[":id"].withdraw.$post({ param: { id: messageId }, json: { items } }),
        messageSchema,
      ),
    getProfileStats: (timeZone) =>
      call((client) => client.profile.stats.$get({ query: { tz: timeZone } }), profileStatsSchema),
    getSessionSummary: (sessionId) =>
      call(
        (client) => client.sessions[":id"].summary.$get({ param: { id: sessionId } }),
        sessionSummarySchema,
      ),
    async deleteAccount() {
      const outcome = await call((client) => client.account.$delete(), accountDeletedSchema);
      return outcome.ok ? { ok: true, value: null } : outcome;
    },
    getMonthProgress: (timeZone) =>
      call(
        (client) => client.progress.month.$get({ query: { tz: timeZone } }),
        monthProgressSchema,
      ),
    listHistory: (timeZone, offset) =>
      call(
        (client) =>
          client.progress.history.$get({ query: { tz: timeZone, offset: String(offset) } }),
        historyPageSchema,
      ),
    listMistakes: (offset) =>
      call(
        (client) => client.progress.mistakes.$get({ query: { offset: String(offset) } }),
        mistakePageSchema,
      ),
    listWords: (timeZone, offset) =>
      call(
        (client) => client.progress.words.$get({ query: { tz: timeZone, offset: String(offset) } }),
        wordPageSchema,
      ),
    async getTodayPractice(timeZone) {
      const outcome = await call(
        (client) => client.practice.today.$get({ query: { tz: timeZone } }),
        practiceTodaySchema,
      );
      return outcome.ok ? { ok: true, value: outcome.value.run } : outcome;
    },
    async listRecentPrompts(days, limit) {
      const outcome = await call(
        (client) =>
          client.practice["recent-prompts"].$get({
            query: { days: String(days), limit: String(limit) },
          }),
        recentPromptsSchema,
      );
      return outcome.ok ? { ok: true, value: outcome.value.items } : outcome;
    },
    createPracticeRun: (input) =>
      call((client) => client.practice.runs.$post({ json: input }), practiceRunSchema),
    openPracticeRun: (runId) =>
      call(
        (client) => client.practice.runs[":id"].$get({ param: { id: runId } }),
        practiceRunWithItemsSchema,
      ),
    async addPracticeItems(runId, items) {
      const outcome = await call(
        (client) =>
          client.practice.runs[":id"].items.$post({ param: { id: runId }, json: { items } }),
        practiceItemsResponseSchema,
      );
      return outcome.ok ? { ok: true, value: outcome.value.items } : outcome;
    },
    answerPracticeItem: (itemId, answer) =>
      call(
        (client) =>
          client.practice.items[":id"].answer.$post({ param: { id: itemId }, json: answer }),
        practiceItemSchema,
      ),
    addPracticeUsage: (runId, usage) =>
      call(
        (client) => client.practice.runs[":id"].usage.$post({ param: { id: runId }, json: usage }),
        practiceRunSchema,
      ),
    setPracticeTarget: (runId, target) =>
      call(
        (client) =>
          client.practice.runs[":id"].target.$post({ param: { id: runId }, json: { target } }),
        practiceRunSchema,
      ),
    finishPracticeRun: (runId) =>
      call(
        (client) => client.practice.runs[":id"].finish.$post({ param: { id: runId } }),
        practiceRunSchema,
      ),
    getMonthSpend: (timeZone) =>
      call((client) => client.sessions.spend.$get({ query: { tz: timeZone } }), monthSpendSchema),
  };
}
