// scripts/test/api-runtime.test.mjs
//
// Test that the API loads under Node the way `dev` does (tsx, no Vitest).
//
// Tested:
// - apps/api/src/app.ts and its shared imports resolve as ESM at runtime
//
// What is covered:
// - Normal case: the import succeeds and exports createApp
// - Edge: a missing export of the shared package fails the test
//
// Run with: node --test scripts/test/api-runtime.test.mjs
//
// SEE: apps/api/package.json

import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const apiDir = path.join(root, "apps/api");

describe("api runtime", () => {
  it("imports app.ts and the shared package under tsx", () => {
    const result = spawnSync(
      "pnpm",
      [
        "exec",
        "tsx",
        "--eval",
        'import("./src/app.ts").then((m) => { if (typeof m.createApp !== "function") process.exit(2); })',
      ],
      { cwd: apiDir, encoding: "utf8", env: { PATH: process.env.PATH, HOME: process.env.HOME } },
    );
    assert.equal(result.status, 0, result.stderr);
  });
});
