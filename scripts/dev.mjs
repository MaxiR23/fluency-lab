#!/usr/bin/env node
// INFO: `pnpm dev` starts the whole local stack from one terminal. In order:
// it checks that Docker is running, starts the local Supabase stack with its
// output hidden (on success it prints the local keys; it also exits 0 when
// the stack is already up), starts the API in its own process group with
// every line prefixed [api], and starts Expo attached to this terminal so the
// QR code and the key shortcuts keep working. Extra arguments go to Expo
// (`pnpm dev --clear`). When Expo exits, or on Ctrl+C, SIGTERM or SIGHUP
// (closing the terminal), the API process group is stopped and the script
// exits with Expo's code. The API is also stopped when the script itself
// exits for any other reason, such as a crash. Supabase stays running; stop it
// with `pnpm supabase:stop`.
//
// A detached child leads its own process group (Node.js child_process docs),
// so Ctrl+C in the terminal does not reach the API and the script stops it by
// signalling the group (negative pid), which covers pnpm and tsx below it.

import { spawn, spawnSync } from "node:child_process";
import { constants } from "node:os";
import path from "node:path";
import { createInterface } from "node:readline";
import { fileURLToPath } from "node:url";

export const DOCKER_COMMAND = { command: "docker", args: ["info"] };
export const SUPABASE_COMMAND = { command: "pnpm", args: ["supabase:start"] };
export const API_COMMAND = { command: "pnpm", args: ["--filter", "api", "dev"] };

export const SHUTDOWN_SIGNALS = ["SIGTERM", "SIGHUP"];

const DOCKER_MESSAGE = "Docker is not running. Open it with `open -a Docker` and try again.";
const SUPABASE_MESSAGE =
  "Supabase did not start. If a container name is already in use, run `pnpm supabase:stop` and try again.";

export function checkDocker({ status }) {
  return status === 0 ? { ok: true } : { ok: false, message: DOCKER_MESSAGE };
}

export function checkSupabase({ status, stderr }) {
  if (status === 0) return { ok: true };
  const output = (stderr ?? "").trim();
  return { ok: false, message: output ? `${output}\n\n${SUPABASE_MESSAGE}` : SUPABASE_MESSAGE };
}

export function expoCommand(extraArgs) {
  const args = extraArgs[0] === "--" ? extraArgs.slice(1) : extraArgs;
  return { command: "pnpm", args: ["--filter", "@fluency-lab/mobile", "start", ...args] };
}

export function prefixApiLine(line) {
  return `[api] ${line}`;
}

export function exitCode(code, signal) {
  if (typeof code === "number") return code;
  const number = signal ? constants.signals[signal] : undefined;
  return typeof number === "number" ? 128 + number : 1;
}

function stop(message) {
  process.stderr.write(`\n[dev] ${message}\n\n`);
  process.exit(1);
}

function pipeWithPrefix(stream, out) {
  createInterface({ input: stream }).on("line", (line) => {
    out.write(`${prefixApiLine(line)}\n`);
  });
}

function main(root, extraArgs) {
  const docker = spawnSync(DOCKER_COMMAND.command, DOCKER_COMMAND.args, { stdio: "ignore" });
  const dockerCheck = checkDocker(docker);
  if (!dockerCheck.ok) stop(dockerCheck.message);

  process.stdout.write("[dev] Starting Supabase...\n");
  const supabase = spawnSync(SUPABASE_COMMAND.command, SUPABASE_COMMAND.args, {
    cwd: root,
    stdio: ["ignore", "ignore", "pipe"],
    encoding: "utf8",
  });
  const supabaseCheck = checkSupabase(supabase);
  if (!supabaseCheck.ok) stop(supabaseCheck.message);
  process.stdout.write("[dev] Supabase is up.\n");

  const api = spawn(API_COMMAND.command, API_COMMAND.args, {
    cwd: root,
    stdio: ["ignore", "pipe", "pipe"],
    detached: true,
  });
  pipeWithPrefix(api.stdout, process.stdout);
  pipeWithPrefix(api.stderr, process.stderr);

  let apiRunning = true;
  let stopping = false;
  let signalled = false;
  api.on("exit", (code, signal) => {
    apiRunning = false;
    if (!stopping) {
      process.stderr.write(`[dev] The API stopped (${code ?? signal}). Expo keeps running.\n`);
    }
  });

  const stopApi = () => {
    stopping = true;
    // The signal handlers, Expo's exit and the process "exit" event can all
    // get here; the group is signalled once.
    if (!apiRunning || signalled) return;
    signalled = true;
    try {
      process.kill(-api.pid, "SIGTERM");
    } catch (error) {
      // ESRCH: the group is already gone between the exit check and the kill.
      if (error?.code !== "ESRCH") throw error;
    }
  };

  const expoLine = expoCommand(extraArgs);
  const expo = spawn(expoLine.command, expoLine.args, { cwd: root, stdio: "inherit" });

  // Ctrl+C reaches Expo directly (same terminal and process group); wait for
  // it to exit instead of dying first and leaving the API behind.
  process.on("SIGINT", () => {});
  for (const signal of SHUTDOWN_SIGNALS) {
    process.on(signal, () => {
      stopApi();
      expo.kill("SIGTERM");
    });
  }
  // Synchronous on purpose ("exit" listeners cannot wait). stopApi never calls
  // process.exit, so this cannot loop; it covers a crash of this script.
  process.on("exit", stopApi);

  expo.on("exit", (code, signal) => {
    stopApi();
    process.exit(exitCode(code, signal));
  });
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
  main(root, process.argv.slice(2));
}
