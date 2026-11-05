import { Hono } from "hono";

// INFO: routes are chained so the type of `app` carries every route to the
// typed client (RPC). Never register routes on separate `app.get(...)` calls.
const app = new Hono().get("/health", (c) => c.json({ ok: true }));

export type AppType = typeof app;
export default app;
