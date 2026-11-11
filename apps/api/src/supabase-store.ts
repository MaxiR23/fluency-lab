import { noteDeletedSchema, type Message } from "@fluency-lab/shared";
import { createClient } from "@supabase/supabase-js";
import {
  toFinishedRun,
  toHistoryRow,
  toMessage,
  toMistakeRow,
  toMonthProgressRow,
  toNoteRow,
  toOpenSession,
  toPracticeItem,
  toPracticeRun,
  toPracticeRunWithItems,
  toProfile,
  toProfilePatch,
  toProfileStatsRow,
  toRecentPrompt,
  toSession,
  toSessionCost,
  toSessionStart,
  toStudyNote,
  toThreadCount,
  toThreadMessage,
  toThreadWords,
  toWordRow,
} from "./rows";
import type { Caller, Store, StoreOutcome, UserStore } from "./store";

export type StoreConfig = {
  url: string;
  publishableKey: string;
  secretKey: string;
  fetchFn: typeof fetch;
  now: () => Date;
};

const DB_TIMEOUT_MS = 5000;

function readVariable(env: Record<string, string | undefined>, name: string): string {
  const raw = env[name];
  if (raw === undefined || raw.trim() === "") throw new Error(`Missing ${name}`);
  return raw.trim();
}

export function storeConfigFromEnv(
  env: Record<string, string | undefined>,
  fetchFn: typeof fetch,
): StoreConfig {
  return {
    url: readVariable(env, "SUPABASE_URL").replace(/\/$/, ""),
    publishableKey: readVariable(env, "SUPABASE_PUBLISHABLE_KEY"),
    secretKey: readVariable(env, "SUPABASE_SECRET_KEY"),
    fetchFn,
    now: () => new Date(),
  };
}

type QueryResult = { data: unknown; error: object | null; status: number };

const unavailable = { ok: false, failure: "unavailable" } as const;
const unauthorized = { ok: false, failure: "unauthorized" } as const;

// INFO: supabase-js does not throw: a rejected or aborted fetch comes back as
// an error with status 0, so no catch is needed here.
function failureOf(result: QueryResult): typeof unavailable | typeof unauthorized | null {
  if (result.error === null) return null;
  return result.status === 401 ? unauthorized : unavailable;
}

function mapRow<T>(result: QueryResult, map: (row: unknown) => T | null): StoreOutcome<T | null> {
  const failed = failureOf(result);
  if (failed !== null) return failed;
  if (result.data === null) return { ok: true, value: null };
  const value = map(result.data);
  return value === null ? unavailable : { ok: true, value };
}

function readPage<T>(result: QueryResult, map: (row: unknown) => T | null): StoreOutcome<T[]> {
  const failed = failureOf(result);
  if (failed !== null) return failed;
  if (!Array.isArray(result.data)) return unavailable;
  const rows = result.data.map(map);
  return rows.every((row) => row !== null) ? { ok: true, value: rows } : unavailable;
}

export function createSupabaseStore(config: StoreConfig, timeoutMs: number = DB_TIMEOUT_MS): Store {
  return {
    forUser(caller: Caller): UserStore {
      // INFO: a server that accepts and never answers must end as unavailable.
      const timed: typeof fetch = (input, init) => {
        const deadline = AbortSignal.timeout(timeoutMs);
        const signal =
          init?.signal === undefined || init.signal === null
            ? deadline
            : AbortSignal.any([init.signal, deadline]);
        return config.fetchFn(input, { ...init, signal });
      };
      // INFO: the caller's token makes Postgres apply row level security as that
      // user. retry is off: postgrest-js would back off for seconds; the app retries.
      const client = createClient(config.url, config.publishableKey, {
        global: { headers: { Authorization: `Bearer ${caller.accessToken}` }, fetch: timed },
        auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
        db: { retry: false },
      });

      async function lastMessage(sessionId: string): Promise<StoreOutcome<Message | null>> {
        const result = await client
          .from("messages")
          .select("*")
          .eq("session_id", sessionId)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();
        return mapRow(result, toMessage);
      }

      async function readCosts(
        table: "sessions" | "deleted_session_costs" | "practice_runs",
        since: string,
      ): Promise<StoreOutcome<{ createdAt: string; costUsd: number }[]>> {
        const result = await client
          .from(table)
          .select("created_at, cost_usd")
          .gte("created_at", since)
          .order("created_at", { ascending: true });
        const failed = failureOf(result);
        if (failed !== null) return failed;
        if (!Array.isArray(result.data)) return unavailable;
        const costs = result.data.map(toSessionCost);
        return costs.every((cost) => cost !== null) ? { ok: true, value: costs } : unavailable;
      }

      return {
        async getProfile() {
          const result = await client
            .from("profiles")
            .select("*")
            .eq("id", caller.id)
            .maybeSingle();
          const found = mapRow(result, toProfile);
          if (!found.ok) return found;
          if (found.value !== null) return { ok: true, value: found.value };
          const created = mapRow(await client.rpc("ensure_profile").maybeSingle(), toProfile);
          if (!created.ok) return created;
          return created.value === null ? unavailable : { ok: true, value: created.value };
        },

        async updateProfile(update) {
          const result = await client
            .from("profiles")
            .update(toProfilePatch(update, config.now()))
            .eq("id", caller.id)
            .select("*")
            .maybeSingle();
          return mapRow(result, toProfile);
        },

        async getActiveSession() {
          const found = await client
            .from("sessions")
            .select("*")
            .eq("status", "active")
            .order("updated_at", { ascending: false })
            .limit(1)
            .maybeSingle();
          const session = mapRow(found, toSession);
          if (!session.ok) return session;
          if (session.value === null) return { ok: true, value: null };
          const last = await lastMessage(session.value.id);
          if (!last.ok) return last;
          return { ok: true, value: { session: session.value, lastMessage: last.value } };
        },

        // INFO: sessions_context_through_fkey is a second relationship to messages, so the
        // embed names messages_session_id_fkey; without it PostgREST answers PGRST201.
        async listOpenSessions() {
          const result = await client
            .from("sessions")
            .select("*, messages!messages_session_id_fkey(*)")
            .eq("status", "active")
            .order("updated_at", { ascending: false })
            .order("created_at", { referencedTable: "messages", ascending: false })
            .limit(1, { referencedTable: "messages" });
          const failed = failureOf(result);
          if (failed !== null) return failed;
          if (!Array.isArray(result.data)) return unavailable;
          const open = result.data.map(toOpenSession);
          return open.every((item) => item !== null) ? { ok: true, value: open } : unavailable;
        },

        async deleteSession(sessionId) {
          const result = await client
            .from("sessions")
            .delete()
            .eq("id", sessionId)
            .select("*")
            .maybeSingle();
          return mapRow(result, toSession);
        },

        async createSession(input) {
          const result = await client
            .from("sessions")
            .insert({ user_id: caller.id, topic_id: input.topicId, title: input.title })
            .select("*")
            .single();
          const mapped = mapRow(result, toSession);
          if (!mapped.ok) return mapped;
          return mapped.value === null ? unavailable : { ok: true, value: mapped.value };
        },

        async listSessionStarts(since) {
          const result = await client
            .from("sessions")
            .select("created_at")
            .gte("created_at", since)
            .order("created_at", { ascending: true });
          const failed = failureOf(result);
          if (failed !== null) return failed;
          if (!Array.isArray(result.data)) return unavailable;
          const starts = result.data.map(toSessionStart);
          return starts.every((start) => start !== null)
            ? { ok: true, value: starts }
            : unavailable;
        },

        async getSessionWithMessages(sessionId) {
          const visible = await client
            .from("sessions")
            .select("*")
            .eq("id", sessionId)
            .maybeSingle();
          const session = mapRow(visible, toSession);
          if (!session.ok) return session;
          if (session.value === null) return { ok: true, value: null };
          const result = await client
            .from("messages")
            .select("*")
            .eq("session_id", sessionId)
            .order("created_at", { ascending: true });
          const failed = failureOf(result);
          if (failed !== null) return failed;
          if (!Array.isArray(result.data)) return unavailable;
          const messages = result.data.map(toMessage);
          return messages.every((m) => m !== null)
            ? { ok: true, value: { session: session.value, messages } }
            : unavailable;
        },

        async addMessage(sessionId, input) {
          const visible = await client
            .from("sessions")
            .select("id")
            .eq("id", sessionId)
            .maybeSingle();
          const visibleFailure = failureOf(visible);
          if (visibleFailure !== null) return visibleFailure;
          if (visible.data === null) return { ok: true, value: null };
          const result = await client
            .from("messages")
            .insert({
              session_id: sessionId,
              role: input.role,
              text: input.text,
              corrections: input.corrections ?? null,
              new_words: input.newWords ?? null,
              reply_to_id: input.replyToId ?? null,
              note_id: input.noteId ?? null,
            })
            .select("*")
            .single();
          const mapped = mapRow(result, toMessage);
          if (!mapped.ok) return mapped;
          return mapped.value === null ? unavailable : { ok: true, value: mapped.value };
        },

        async getThread(messageId) {
          const found = mapRow(
            await client.from("messages").select("*").eq("id", messageId).maybeSingle(),
            toMessage,
          );
          if (!found.ok) return found;
          if (found.value === null) return { ok: true, value: null };
          const message = found.value;
          const owner = mapRow(
            await client.from("sessions").select("*").eq("id", message.sessionId).maybeSingle(),
            toSession,
          );
          if (!owner.ok) return owner;
          // INFO: a message the caller can see always has its session visible.
          if (owner.value === null) return unavailable;
          const rows = readPage(
            await client
              .from("thread_messages")
              .select("*")
              .eq("message_id", messageId)
              .order("created_at", { ascending: true }),
            toThreadMessage,
          );
          if (!rows.ok) return rows;
          return { ok: true, value: { session: owner.value, message, messages: rows.value } };
        },

        async addThreadMessage(messageId, input) {
          const visible = await client
            .from("messages")
            .select("id")
            .eq("id", messageId)
            .maybeSingle();
          const visibleFailure = failureOf(visible);
          if (visibleFailure !== null) return visibleFailure;
          if (visible.data === null) return { ok: true, value: null };
          const result = await client
            .from("thread_messages")
            .insert({
              message_id: messageId,
              role: input.role,
              text: input.text,
              new_words: input.newWords ?? null,
            })
            .select("*")
            .single();
          const mapped = mapRow(result, toThreadMessage);
          if (!mapped.ok) return mapped;
          return mapped.value === null ? unavailable : { ok: true, value: mapped.value };
        },

        async withdrawCorrections(messageId, items) {
          const result = await client
            .rpc("withdraw_corrections", { message_id: messageId, item_indexes: items })
            .maybeSingle();
          return mapRow(result, toMessage);
        },

        async listThreadCounts(sessionId) {
          return readPage(
            await client.rpc("thread_counts", { session_id: sessionId }),
            toThreadCount,
          );
        },

        // INFO: messages!inner keeps only the rows whose message is in the session; row level
        // security keeps out every other user's rows. Rows with no words are not fetched.
        async listThreadWords(sessionId) {
          const rows = readPage(
            await client
              .from("thread_messages")
              .select("new_words, messages!inner(session_id)")
              .eq("messages.session_id", sessionId)
              .not("new_words", "is", null)
              .order("created_at", { ascending: true }),
            toThreadWords,
          );
          return rows.ok ? { ok: true, value: rows.value.flat() } : rows;
        },

        async listPracticeRunsSince(since) {
          const result = await client
            .from("practice_runs")
            .select("*, practice_items(*)")
            .gte("created_at", since)
            .order("created_at", { ascending: true });
          return readPage(result, toPracticeRunWithItems);
        },

        async listFinishedRunsSince(since) {
          const result = await client
            .from("practice_runs")
            .select("finished_at, practice_items(correct)")
            .gte("finished_at", since)
            .order("finished_at", { ascending: true });
          return readPage(result, toFinishedRun);
        },

        async listRecentPrompts(since, limit) {
          const result = await client
            .from("practice_items")
            .select("run_id, prompt, rule, practice_runs!inner(created_at)")
            .gte("practice_runs.created_at", since)
            .order("practice_runs(created_at)", { ascending: false })
            .order("position", { ascending: false })
            .limit(limit);
          return readPage(result, toRecentPrompt);
        },

        async createPracticeRun(input) {
          if (input.focus === "note") {
            const visible = await client
              .from("study_notes")
              .select("id")
              .eq("id", input.noteId)
              .maybeSingle();
            const visibleFailure = failureOf(visible);
            if (visibleFailure !== null) return visibleFailure;
            if (visible.data === null) return { ok: true, value: null };
          }
          const result = await client
            .from("practice_runs")
            .insert({
              user_id: caller.id,
              focus: input.focus,
              topic_id: input.focus === "topic" ? input.topicId : null,
              note_id: input.focus === "note" ? input.noteId : null,
              target: input.target,
            })
            .select("*")
            .single();
          const mapped = mapRow(result, toPracticeRun);
          if (!mapped.ok) return mapped;
          return mapped.value === null ? unavailable : { ok: true, value: mapped.value };
        },

        async createNote(input) {
          if (input.sessionId !== null) {
            const visible = await client
              .from("sessions")
              .select("id")
              .eq("id", input.sessionId)
              .maybeSingle();
            const visibleFailure = failureOf(visible);
            if (visibleFailure !== null) return visibleFailure;
            if (visible.data === null) return { ok: true, value: null };
          }
          const result = await client
            .from("study_notes")
            .insert({
              user_id: caller.id,
              session_id: input.sessionId,
              kind: input.kind,
              title: input.title,
              topic: input.topic,
              content: input.content,
            })
            .select("*, sessions(title)")
            .single();
          const mapped = mapRow(result, toStudyNote);
          if (!mapped.ok) return mapped;
          return mapped.value === null ? unavailable : { ok: true, value: mapped.value };
        },

        async getNote(noteId) {
          const result = await client
            .from("study_notes")
            .select("*, sessions(title)")
            .eq("id", noteId)
            .maybeSingle();
          return mapRow(result, toStudyNote);
        },

        async deleteNote(noteId) {
          const result = await client
            .from("study_notes")
            .delete()
            .eq("id", noteId)
            .select("id")
            .maybeSingle();
          return mapRow(result, (row) => {
            const parsed = noteDeletedSchema.safeParse(row);
            return parsed.success ? parsed.data : null;
          });
        },

        async listNotes(offset, limit) {
          const result = await client
            .from("study_notes")
            .select("id, kind, title, topic, created_at")
            .order("created_at", { ascending: false })
            .order("id", { ascending: false })
            .range(offset, offset + limit - 1);
          return readPage(result, toNoteRow);
        },

        async listSessionNotes(sessionId) {
          const result = await client
            .from("study_notes")
            .select("*, sessions(title)")
            .eq("session_id", sessionId)
            .order("created_at", { ascending: true });
          return readPage(result, toStudyNote);
        },

        async getPracticeRun(runId) {
          const result = await client
            .from("practice_runs")
            .select("*, practice_items(*)")
            .eq("id", runId)
            .maybeSingle();
          return mapRow(result, toPracticeRunWithItems);
        },

        async addPracticeItems(runId, items) {
          const visible = await client
            .from("practice_runs")
            .select("id")
            .eq("id", runId)
            .maybeSingle();
          const visibleFailure = failureOf(visible);
          if (visibleFailure !== null) return visibleFailure;
          if (visible.data === null) return { ok: true, value: null };
          // INFO: a position already saved is ignored, so a retry after a lost
          // response never fails or duplicates. The run's items are read back.
          const saved = await client.from("practice_items").upsert(
            items.map((item) => ({
              run_id: runId,
              position: item.position,
              kind: item.kind,
              rule: item.rule,
              prompt: item.prompt,
              options: item.options,
              accepted: item.accepted,
              explanation: item.explanation,
              source: item.source,
            })),
            { onConflict: "run_id,position", ignoreDuplicates: true },
          );
          const savedFailure = failureOf(saved);
          if (savedFailure !== null) return savedFailure;
          const all = await client
            .from("practice_items")
            .select("*")
            .eq("run_id", runId)
            .order("position", { ascending: true });
          return readPage(all, toPracticeItem);
        },

        async answerPracticeItem(itemId, answer, answeredAt) {
          const result = await client
            .from("practice_items")
            .update({
              user_answer: answer.userAnswer,
              correct: answer.correct,
              answered_at: answeredAt,
            })
            .eq("id", itemId)
            .select("*")
            .maybeSingle();
          return mapRow(result, toPracticeItem);
        },

        async addPracticeCost(runId, amountUsd) {
          const result = await client
            .rpc("add_practice_cost", { run_id: runId, amount_usd: amountUsd })
            .maybeSingle();
          return mapRow(result, toPracticeRun);
        },

        async setPracticeTarget(runId, target) {
          const result = await client
            .from("practice_runs")
            .update({ target })
            .eq("id", runId)
            .select("*")
            .maybeSingle();
          return mapRow(result, toPracticeRun);
        },

        async finishPracticeRun(runId, finishedAt) {
          const result = await client
            .from("practice_runs")
            .update({ finished_at: finishedAt })
            .eq("id", runId)
            .select("*")
            .maybeSingle();
          return mapRow(result, toPracticeRun);
        },

        async addSessionCost(sessionId, amountUsd) {
          const result = await client
            .rpc("add_session_cost", { session_id: sessionId, amount_usd: amountUsd })
            .maybeSingle();
          return mapRow(result, toSession);
        },

        async setSessionContext(sessionId, context) {
          const result = await client
            .from("sessions")
            .update({ context_summary: context.summary, context_through_id: context.throughId })
            .eq("id", sessionId)
            .select("*")
            .maybeSingle();
          return mapRow(result, toSession);
        },

        async setSessionTitle(sessionId, input) {
          const result = await client
            .rpc("set_session_title", {
              session_id: sessionId,
              new_title: input.title,
              source: input.source,
            })
            .maybeSingle();
          return mapRow(result, toSession);
        },

        async endSession(sessionId) {
          const result = await client
            .from("sessions")
            .update({ status: "ended" })
            .eq("id", sessionId)
            .select("*")
            .maybeSingle();
          return mapRow(result, toSession);
        },

        async getStats(timeZone) {
          const result = await client.rpc("profile_stats", { time_zone: timeZone }).maybeSingle();
          const mapped = mapRow(result, toProfileStatsRow);
          if (!mapped.ok) return mapped;
          // INFO: the function always returns one row, so no row is a bad answer.
          return mapped.value === null ? unavailable : { ok: true, value: mapped.value };
        },

        async getMonthProgress(timeZone, monthStart) {
          const result = await client
            .rpc("progress_month", { time_zone: timeZone, month_start: monthStart })
            .maybeSingle();
          const mapped = mapRow(result, toMonthProgressRow);
          if (!mapped.ok) return mapped;
          // INFO: the function always returns one row, so no row is a bad answer.
          return mapped.value === null ? unavailable : { ok: true, value: mapped.value };
        },

        async listEndedSessions(offset, limit) {
          return readPage(
            await client.rpc("progress_history", { page_offset: offset, page_size: limit }),
            toHistoryRow,
          );
        },

        async listMistakeGroups(offset, limit) {
          return readPage(
            await client.rpc("progress_mistakes", { page_offset: offset, page_size: limit }),
            toMistakeRow,
          );
        },

        async listNewWords(offset, limit) {
          return readPage(
            await client.rpc("progress_words", { page_offset: offset, page_size: limit }),
            toWordRow,
          );
        },

        async deleteAccount() {
          // INFO: the secret key bypasses row level security. This client is for
          // deletion only and carries no caller header. Per the Supabase docs a user
          // is deleted through the admin API (auth.admin.deleteUser), not with SQL on
          // auth.users, which is Supabase-managed. A 404 means the user is already
          // gone, which is the outcome the route promises, so it is a success.
          const admin = createClient(config.url, config.secretKey, {
            auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
            global: { fetch: timed },
          });
          try {
            const { error } = await admin.auth.admin.deleteUser(caller.id);
            if (error === null || error.status === 404) return { ok: true, value: null };
            return unavailable;
          } catch {
            // INFO: deleteUser rethrows a non-auth error and rejects an id that is not
            // a uuid; both end as a typed failure, never as a success.
            return unavailable;
          }
        },

        async listSessionCostsSince(since) {
          // INFO: a deleted session keeps its cost in deleted_session_costs
          // (a trigger copies it), so deleting a chat never lowers the spend.
          const sessions = await readCosts("sessions", since);
          if (!sessions.ok) return sessions;
          const deleted = await readCosts("deleted_session_costs", since);
          if (!deleted.ok) return deleted;
          // INFO: a practice run's cost counts too. Runs cannot be deleted by a
          // user (no delete grant), so no ledger is needed.
          const runs = await readCosts("practice_runs", since);
          if (!runs.ok) return runs;
          return { ok: true, value: [...sessions.value, ...deleted.value, ...runs.value] };
        },
      };
    },
  };
}
