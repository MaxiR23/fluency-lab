import {
  type Profile,
  type ProfileUpdate,
  accountDeletedSchema,
  activeSessionResponseSchema,
  messageSchema,
  monthSpendSchema,
  openSessionsResponseSchema,
  profileSchema,
  profileStatsSchema,
  sessionMessagesResponseSchema,
  sessionSchema,
  sessionWeekSchema,
} from "@fluency-lab/shared";
// INFO: type-only, so Metro never bundles the server.
import type { AppType } from "api";
import { hc } from "hono/client";

import type { DataOutcome, DataPort } from "@/data/data-port";
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
    const token = await config.readToken();
    if (!token.ok) return { ok: false, failure: token.failure };
    type Read =
      { kind: "status"; status: number } | { kind: "body"; body: unknown } | { kind: "bad" };
    let read: Read | typeof DEADLINE;
    try {
      read = await withinDeadline<Read>(timeoutMs, async (signal) => {
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
    endSession: (sessionId) =>
      call(
        (client) => client.sessions[":id"].end.$post({ param: { id: sessionId } }),
        sessionSchema,
      ),
    getProfileStats: (timeZone) =>
      call((client) => client.profile.stats.$get({ query: { tz: timeZone } }), profileStatsSchema),
    async deleteAccount() {
      const outcome = await call((client) => client.account.$delete(), accountDeletedSchema);
      return outcome.ok ? { ok: true, value: null } : outcome;
    },
    getMonthSpend: (timeZone) =>
      call((client) => client.sessions.spend.$get({ query: { tz: timeZone } }), monthSpendSchema),
  };
}
