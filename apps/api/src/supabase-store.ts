import { createClient } from "@supabase/supabase-js";
import type { Message } from "@fluency-lab/shared";
import {
  toMessage,
  toOpenSession,
  toProfile,
  toProfilePatch,
  toProfileStatsRow,
  toSession,
  toSessionCost,
  toSessionStart,
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
        table: "sessions" | "deleted_session_costs",
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

        async listOpenSessions() {
          const result = await client
            .from("sessions")
            .select("*, messages(*)")
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
            })
            .select("*")
            .single();
          const mapped = mapRow(result, toMessage);
          if (!mapped.ok) return mapped;
          return mapped.value === null ? unavailable : { ok: true, value: mapped.value };
        },

        async addSessionCost(sessionId, amountUsd) {
          const result = await client
            .rpc("add_session_cost", { session_id: sessionId, amount_usd: amountUsd })
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
          return { ok: true, value: [...sessions.value, ...deleted.value] };
        },
      };
    },
  };
}
