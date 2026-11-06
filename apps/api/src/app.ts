import {
  messageCreateSchema,
  profileUpdateSchema,
  sessionCreateSchema,
  sessionIdParamSchema,
  sessionTitle,
  sessionUsageSchema,
  starterById,
  usageCostUsd,
  weekQuerySchema,
} from "@fluency-lab/shared";
import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import { createMiddleware } from "hono/factory";
// INFO: type-only; loads the typing of c.get("jwtPayload") for every program that
// compiles this file, the mobile app's typecheck included.
import type {} from "hono/jwt";
import { requireAuth, readBearerToken, readTokenUser, type AuthConfig } from "./auth";
import { MONTH_LOOKBACK_MS, currentMonthStart, monthSpend } from "./month";
import type { Caller, Store, StoreFailure } from "./store";
import { dayStreak } from "./streak";
import { WEEK_LOOKBACK_MS, currentWeek, isTimeZone, sessionDays } from "./week";

// INFO: no zod issue text leaves the API.
const invalidInput = (
  result: { success: boolean },
  c: { json: (body: { error: "invalid_input" }, status: 400) => Response },
) => {
  if (!result.success) return c.json({ error: "invalid_input" }, 400);
};

export function failureResponse(failure: StoreFailure) {
  return failure === "unauthorized"
    ? ({ status: 401, body: { error: "unauthorized" } } as const)
    : ({ status: 503, body: { error: "unavailable" } } as const);
}

// INFO: routes are chained so the type of `app` carries every route to the
// typed client (RPC). Never register routes on separate `app.get(...)` calls.
export function createApp(config: { auth: AuthConfig; store: Store; now?: () => Date }) {
  const now = config.now ?? (() => new Date());
  const caller = createMiddleware<{ Variables: { caller: Caller } }>(async (c, next) => {
    const user = readTokenUser(c.get("jwtPayload"));
    const accessToken = readBearerToken(c.req.header("Authorization"));
    if (user === null || accessToken === null) return c.json({ error: "unauthorized" }, 401);
    c.set("caller", { id: user.id, accessToken });
    await next();
  });
  const auth = requireAuth(config.auth);

  return new Hono()
    .get("/health", (c) => c.json({ ok: true }))
    .get("/me", auth, (c) => {
      const user = readTokenUser(c.get("jwtPayload"));
      if (user === null) return c.json({ error: "unauthorized" }, 401);
      return c.json(user);
    })
    .get("/profile", auth, caller, async (c) => {
      const outcome = await config.store.forUser(c.get("caller")).getProfile();
      if (!outcome.ok) {
        const { status, body } = failureResponse(outcome.failure);
        return c.json(body, status);
      }
      return c.json(outcome.value, 200);
    })
    .put(
      "/profile",
      auth,
      caller,
      zValidator("json", profileUpdateSchema, invalidInput),
      async (c) => {
        const outcome = await config.store
          .forUser(c.get("caller"))
          .updateProfile(c.req.valid("json"));
        if (!outcome.ok) {
          const { status, body } = failureResponse(outcome.failure);
          return c.json(body, status);
        }
        if (outcome.value === null) return c.json({ error: "not_found" }, 404);
        return c.json(outcome.value, 200);
      },
    )
    .get(
      "/profile/stats",
      auth,
      caller,
      zValidator(
        "query",
        weekQuerySchema.refine((query) => isTimeZone(query.tz)),
        invalidInput,
      ),
      async (c) => {
        const { tz } = c.req.valid("query");
        const { today } = currentWeek(now(), tz);
        const outcome = await config.store.forUser(c.get("caller")).getStats(tz);
        if (!outcome.ok) {
          const { status, body } = failureResponse(outcome.failure);
          return c.json(body, status);
        }
        const { sessionCount, sessionDays, newWords } = outcome.value;
        return c.json(
          { sessions: sessionCount, dayStreak: dayStreak(sessionDays, today), newWords },
          200,
        );
      },
    )
    .delete("/account", auth, caller, async (c) => {
      const outcome = await config.store.forUser(c.get("caller")).deleteAccount();
      if (!outcome.ok) {
        const { status, body } = failureResponse(outcome.failure);
        return c.json(body, status);
      }
      return c.json({ deleted: true as const }, 200);
    })
    .get("/sessions/active", auth, caller, async (c) => {
      const outcome = await config.store.forUser(c.get("caller")).getActiveSession();
      if (!outcome.ok) {
        const { status, body } = failureResponse(outcome.failure);
        return c.json(body, status);
      }
      return c.json({ activeSession: outcome.value }, 200);
    })
    .get("/sessions/open", auth, caller, async (c) => {
      const outcome = await config.store.forUser(c.get("caller")).listOpenSessions();
      if (!outcome.ok) {
        const { status, body } = failureResponse(outcome.failure);
        return c.json(body, status);
      }
      return c.json({ sessions: outcome.value }, 200);
    })
    .get(
      "/sessions/week",
      auth,
      caller,
      zValidator(
        "query",
        weekQuerySchema.refine((query) => isTimeZone(query.tz)),
        invalidInput,
      ),
      async (c) => {
        const { tz } = c.req.valid("query");
        const at = now();
        const { weekStart, today } = currentWeek(at, tz);
        const since = new Date(at.getTime() - WEEK_LOOKBACK_MS).toISOString();
        const outcome = await config.store.forUser(c.get("caller")).listSessionStarts(since);
        if (!outcome.ok) {
          const { status, body } = failureResponse(outcome.failure);
          return c.json(body, status);
        }
        return c.json({ weekStart, today, days: sessionDays(outcome.value, tz, weekStart) }, 200);
      },
    )
    .get(
      "/sessions/spend",
      auth,
      caller,
      zValidator(
        "query",
        weekQuerySchema.refine((query) => isTimeZone(query.tz)),
        invalidInput,
      ),
      async (c) => {
        const { tz } = c.req.valid("query");
        const at = now();
        const monthStart = currentMonthStart(at, tz);
        const since = new Date(at.getTime() - MONTH_LOOKBACK_MS).toISOString();
        const outcome = await config.store.forUser(c.get("caller")).listSessionCostsSince(since);
        if (!outcome.ok) {
          const { status, body } = failureResponse(outcome.failure);
          return c.json(body, status);
        }
        return c.json({ monthStart, spentUsd: monthSpend(outcome.value, tz, monthStart) }, 200);
      },
    )
    .post(
      "/sessions",
      auth,
      caller,
      zValidator("json", sessionCreateSchema, invalidInput),
      async (c) => {
        const body = c.req.valid("json");
        // INFO: the schema guarantees the starter exists; the title and topic
        // come from the shared catalog, never from the client.
        const starter = "starterId" in body ? starterById(body.starterId) : undefined;
        const input =
          "starterId" in body
            ? starter === undefined
              ? null
              : { topicId: starter.topicId, title: starter.title }
            : { topicId: body.topicId, title: sessionTitle(body.topicId) };
        if (input === null) return c.json({ error: "invalid_input" }, 400);
        const outcome = await config.store.forUser(c.get("caller")).createSession(input);
        if (!outcome.ok) {
          const { status, body: failure } = failureResponse(outcome.failure);
          return c.json(failure, status);
        }
        return c.json(outcome.value, 201);
      },
    )
    .get(
      "/sessions/:id/messages",
      auth,
      caller,
      zValidator("param", sessionIdParamSchema, invalidInput),
      async (c) => {
        const outcome = await config.store
          .forUser(c.get("caller"))
          .getSessionWithMessages(c.req.valid("param").id);
        if (!outcome.ok) {
          const { status, body } = failureResponse(outcome.failure);
          return c.json(body, status);
        }
        if (outcome.value === null) return c.json({ error: "not_found" }, 404);
        return c.json(outcome.value, 200);
      },
    )
    .post(
      "/sessions/:id/messages",
      auth,
      caller,
      zValidator("param", sessionIdParamSchema, invalidInput),
      zValidator("json", messageCreateSchema, invalidInput),
      async (c) => {
        const outcome = await config.store
          .forUser(c.get("caller"))
          .addMessage(c.req.valid("param").id, c.req.valid("json"));
        if (!outcome.ok) {
          const { status, body } = failureResponse(outcome.failure);
          return c.json(body, status);
        }
        if (outcome.value === null) return c.json({ error: "not_found" }, 404);
        return c.json(outcome.value, 201);
      },
    )
    .post(
      "/sessions/:id/usage",
      auth,
      caller,
      zValidator("param", sessionIdParamSchema, invalidInput),
      zValidator("json", sessionUsageSchema, invalidInput),
      async (c) => {
        const usage = c.req.valid("json");
        const outcome = await config.store
          .forUser(c.get("caller"))
          .addSessionCost(c.req.valid("param").id, usageCostUsd(usage.model, usage));
        if (!outcome.ok) {
          const { status, body } = failureResponse(outcome.failure);
          return c.json(body, status);
        }
        if (outcome.value === null) return c.json({ error: "not_found" }, 404);
        return c.json(outcome.value, 200);
      },
    )
    .post(
      "/sessions/:id/end",
      auth,
      caller,
      zValidator("param", sessionIdParamSchema, invalidInput),
      async (c) => {
        const outcome = await config.store
          .forUser(c.get("caller"))
          .endSession(c.req.valid("param").id);
        if (!outcome.ok) {
          const { status, body } = failureResponse(outcome.failure);
          return c.json(body, status);
        }
        if (outcome.value === null) return c.json({ error: "not_found" }, 404);
        return c.json(outcome.value, 200);
      },
    )
    .delete(
      "/sessions/:id",
      auth,
      caller,
      zValidator("param", sessionIdParamSchema, invalidInput),
      async (c) => {
        const outcome = await config.store
          .forUser(c.get("caller"))
          .deleteSession(c.req.valid("param").id);
        if (!outcome.ok) {
          const { status, body } = failureResponse(outcome.failure);
          return c.json(body, status);
        }
        if (outcome.value === null) return c.json({ error: "not_found" }, 404);
        return c.json(outcome.value, 200);
      },
    );
}

export type AppType = ReturnType<typeof createApp>;
