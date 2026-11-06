import {
  profileUpdateSchema,
  sessionCreateSchema,
  sessionIdParamSchema,
  sessionTitle,
} from "@fluency-lab/shared";
import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import { createMiddleware } from "hono/factory";
// INFO: type-only; loads the typing of c.get("jwtPayload") for every program that
// compiles this file, the mobile app's typecheck included.
import type {} from "hono/jwt";
import { requireAuth, readBearerToken, readTokenUser, type AuthConfig } from "./auth";
import type { Caller, Store, StoreFailure } from "./store";

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
export function createApp(config: { auth: AuthConfig; store: Store }) {
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
      if (outcome.value === null) return c.json({ error: "not_found" }, 404);
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
    .get("/sessions/active", auth, caller, async (c) => {
      const outcome = await config.store.forUser(c.get("caller")).getActiveSession();
      if (!outcome.ok) {
        const { status, body } = failureResponse(outcome.failure);
        return c.json(body, status);
      }
      return c.json({ activeSession: outcome.value }, 200);
    })
    .post(
      "/sessions",
      auth,
      caller,
      zValidator("json", sessionCreateSchema, invalidInput),
      async (c) => {
        const { topicId } = c.req.valid("json");
        const outcome = await config.store
          .forUser(c.get("caller"))
          .createSession({ topicId, title: sessionTitle(topicId) });
        if (!outcome.ok) {
          const { status, body } = failureResponse(outcome.failure);
          return c.json(body, status);
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
          .listMessages(c.req.valid("param").id);
        if (!outcome.ok) {
          const { status, body } = failureResponse(outcome.failure);
          return c.json(body, status);
        }
        if (outcome.value === null) return c.json({ error: "not_found" }, 404);
        return c.json({ messages: outcome.value }, 200);
      },
    );
}

export type AppType = ReturnType<typeof createApp>;
