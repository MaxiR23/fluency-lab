// scripts/test/dev.test.mjs
//
// Tests for the pure decisions of scripts/dev.mjs (pnpm dev).
//
// Tested:
// - The Docker check passes on exit 0 and stops with the open hint otherwise
// - The Supabase check passes on exit 0 and stops with its stderr and the stop hint otherwise
// - The command lines for Docker, Supabase, the API and Expo
// - Extra arguments reach Expo, without a leading `--`
// - Every API line gets the [api] prefix
// - Closing the terminal (SIGHUP) is handled like SIGTERM
// - The exit code mirrors Expo's code, or its signal when it had none
//
// What is covered:
// - Normal case, empty case, edges
//
// Run with: node --test scripts/test/dev.test.mjs
//
// SEE: scripts/dev.mjs

import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  API_COMMAND,
  DOCKER_COMMAND,
  SHUTDOWN_SIGNALS,
  SUPABASE_COMMAND,
  checkDocker,
  checkSupabase,
  exitCode,
  expoCommand,
  prefixApiLine,
} from "../dev.mjs";

describe("checkDocker", () => {
  it("passes when docker info exits 0", () => {
    assert.deepEqual(checkDocker({ status: 0 }), { ok: true });
  });

  it("stops with the open hint when docker info exits non-zero", () => {
    const result = checkDocker({ status: 1 });
    assert.equal(result.ok, false);
    assert.match(result.message, /Docker is not running/);
    assert.match(result.message, /open -a Docker/);
  });

  it("stops when docker is not installed (no status)", () => {
    const result = checkDocker({ status: null, error: new Error("spawn docker ENOENT") });
    assert.equal(result.ok, false);
    assert.match(result.message, /Docker is not running/);
  });
});

describe("checkSupabase", () => {
  it("passes when supabase start exits 0, also when the stack was already up", () => {
    assert.deepEqual(checkSupabase({ status: 0, stderr: "" }), { ok: true });
  });

  it("stops with its stderr and the stop hint when supabase start fails", () => {
    const stderr = 'The container name "/supabase_analytics_fluency-lab" is already in use';
    const result = checkSupabase({ status: 1, stderr });
    assert.equal(result.ok, false);
    assert.match(result.message, /already in use/);
    assert.match(result.message, /pnpm supabase:stop/);
  });

  it("stops with only the hint when the failure printed nothing", () => {
    const result = checkSupabase({ status: 1, stderr: "" });
    assert.equal(result.ok, false);
    assert.match(result.message, /^Supabase did not start/);
  });

  it("stops when the command could not run at all (no status, no stderr)", () => {
    const result = checkSupabase({ status: null, stderr: null });
    assert.equal(result.ok, false);
    assert.match(result.message, /pnpm supabase:stop/);
  });
});

describe("command lines", () => {
  it("checks Docker with docker info", () => {
    assert.deepEqual(DOCKER_COMMAND, { command: "docker", args: ["info"] });
  });

  it("starts Supabase through the root script", () => {
    assert.deepEqual(SUPABASE_COMMAND, { command: "pnpm", args: ["supabase:start"] });
  });

  it("starts the API through its workspace dev script", () => {
    assert.deepEqual(API_COMMAND, { command: "pnpm", args: ["--filter", "api", "dev"] });
  });

  it("starts Expo with no extra arguments", () => {
    assert.deepEqual(expoCommand([]), {
      command: "pnpm",
      args: ["--filter", "@fluency-lab/mobile", "start"],
    });
  });

  it("passes extra arguments to Expo", () => {
    assert.deepEqual(expoCommand(["--clear"]).args, [
      "--filter",
      "@fluency-lab/mobile",
      "start",
      "--clear",
    ]);
  });

  it("drops a leading -- before the Expo arguments", () => {
    assert.deepEqual(expoCommand(["--", "--clear"]).args, [
      "--filter",
      "@fluency-lab/mobile",
      "start",
      "--clear",
    ]);
  });

  it("keeps a -- that is not the first argument", () => {
    assert.deepEqual(expoCommand(["--clear", "--"]).args.slice(3), ["--clear", "--"]);
  });
});

describe("prefixApiLine", () => {
  it("prefixes a log line", () => {
    assert.equal(prefixApiLine("Listening on 3000"), "[api] Listening on 3000");
  });

  it("prefixes an empty line", () => {
    assert.equal(prefixApiLine(""), "[api] ");
  });
});

describe("exitCode", () => {
  it("mirrors a normal exit", () => {
    assert.equal(exitCode(0, null), 0);
  });

  it("mirrors a failing exit", () => {
    assert.equal(exitCode(2, null), 2);
  });

  it("uses 128 plus the signal number when Expo was killed by a signal", () => {
    assert.equal(exitCode(null, "SIGINT"), 130);
    assert.equal(exitCode(null, "SIGTERM"), 143);
  });

  it("falls back to 1 with neither a code nor a known signal", () => {
    assert.equal(exitCode(null, null), 1);
    assert.equal(exitCode(null, "SIGNOTREAL"), 1);
  });
});

describe("SHUTDOWN_SIGNALS", () => {
  it("handles SIGTERM and SIGHUP, so closing the terminal stops the API too", () => {
    assert.deepEqual([...SHUTDOWN_SIGNALS].sort(), ["SIGHUP", "SIGTERM"]);
  });

  it("does not include SIGINT, which Expo receives directly", () => {
    assert.equal(SHUTDOWN_SIGNALS.includes("SIGINT"), false);
  });
});
