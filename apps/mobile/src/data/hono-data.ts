import {
  type Profile,
  type ProfileUpdate,
  activeSessionResponseSchema,
  messagesResponseSchema,
  profileSchema,
  sessionSchema,
  sessionWeekSchema,
} from "@fluency-lab/shared";
// INFO: type-only, so Metro never bundles the server.
import type { AppType } from "api";
import { hc } from "hono/client";

import type { DataOutcome, DataPort } from "@/data/data-port";
import { toDataFailure } from "@/utils/data-error";
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

const DEADLINE = Symbol("deadline");

// INFO: AbortController and setTimeout instead of AbortSignal.timeout, whose
// presence in the React Native runtime is not verified. The timer stays on
// until the work ends, so it covers the body read too; the race settles even
// when the body never does.
async function withinDeadline<T>(
  timeoutMs: number,
  work: (signal: AbortSignal) => Promise<T>,
): Promise<T | typeof DEADLINE> {
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  const expired = new Promise<typeof DEADLINE>((resolve) => {
    timer = setTimeout(() => {
      controller.abort();
      resolve(DEADLINE);
    }, timeoutMs);
  });
  try {
    return await Promise.race([work(controller.signal), expired]);
  } finally {
    clearTimeout(timer);
  }
}

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
    createSession: (input) =>
      call((client) => client.sessions.$post({ json: input }), sessionSchema),
    getSessionWeek: (timeZone) =>
      call((client) => client.sessions.week.$get({ query: { tz: timeZone } }), sessionWeekSchema),
    async listMessages(sessionId) {
      const outcome = await call(
        (client) => client.sessions[":id"].messages.$get({ param: { id: sessionId } }),
        messagesResponseSchema,
      );
      return outcome.ok ? { ok: true, value: outcome.value.messages } : outcome;
    },
  };
}
