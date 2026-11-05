import { Hono } from "hono";
import { requireAuth, readTokenUser, type AuthConfig } from "./auth";

// INFO: routes are chained so the type of `app` carries every route to the
// typed client (RPC). Never register routes on separate `app.get(...)` calls.
export function createApp(config: { auth: AuthConfig }) {
  return new Hono()
    .get("/health", (c) => c.json({ ok: true }))
    .get("/me", requireAuth(config.auth), (c) => {
      const user = readTokenUser(c.get("jwtPayload"));
      if (user === null) return c.json({ error: "unauthorized" }, 401);
      return c.json(user);
    });
}

export type AppType = ReturnType<typeof createApp>;
