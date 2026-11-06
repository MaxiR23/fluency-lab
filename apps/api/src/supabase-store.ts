import { createClient } from "@supabase/supabase-js";
import type { Message } from "@fluency-lab/shared";
import { toMessage, toProfile, toProfilePatch, toSession } from "./rows";
import type { Caller, Store, StoreOutcome, UserStore } from "./store";

export type StoreConfig = {
  url: string;
  publishableKey: string;
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

      return {
        async getProfile() {
          const result = await client
            .from("profiles")
            .select("*")
            .eq("id", caller.id)
            .maybeSingle();
          return mapRow(result, toProfile);
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

        async listMessages(sessionId) {
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
            .select("*")
            .eq("session_id", sessionId)
            .order("created_at", { ascending: true });
          const failed = failureOf(result);
          if (failed !== null) return failed;
          if (!Array.isArray(result.data)) return unavailable;
          const messages = result.data.map(toMessage);
          return messages.every((m) => m !== null) ? { ok: true, value: messages } : unavailable;
        },
      };
    },
  };
}
