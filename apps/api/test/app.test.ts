// apps/api/test/app.test.ts
//
// Tests for the routes of the app.
//
// Tested:
// - GET /health responds 200 with { ok: true }
// - an unknown route responds 404
// - the typed client sees /health (typecheck fails if AppType loses it)
//
// What is covered:
// - Normal case, empty case, edges
//
// Run with: pnpm exec vitest run apps/api/test/app.test.ts
//
// SEE: apps/api/src/app.ts

import { describe, expect, it } from "vitest";
import { testClient } from "hono/testing";
import app from "../src/app";

describe("GET /health", () => {
  it("responds 200 with { ok: true }", async () => {
    const res = await app.request("/health");

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
  });

  it("responds 404 on a route that does not exist", async () => {
    const res = await app.request("/nope");

    expect(res.status).toBe(404);
  });
});

describe("typed client", () => {
  it("exposes /health through AppType", async () => {
    // INFO: `client.health` only typechecks while the routes are chained.
    const client = testClient(app);
    const res = await client.health.$get();

    expect(await res.json()).toEqual({ ok: true });
  });
});
