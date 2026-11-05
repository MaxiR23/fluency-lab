#!/usr/bin/env node
// INFO: PreToolUse hook on Bash that enforces the gate attempt limit of
// implement-issue (CLAUDE.md, docs/workflow.md). It reads the hook input
// from stdin and acts only when agent_type is "implement-issue": the main
// session, scripts/ship.sh and every other agent pass untouched.
//
// For that agent it counts the commands that run `pnpm gate` (piped,
// chained or as `pnpm run gate`), one counter per agent_id under
// .claude/loop/ (not versioned). Calls 1 to 3 pass; from the fourth on the
// call is denied before it runs. It also denies the gate's parts
// (`pnpm typecheck`, `pnpm lint`, `pnpm test`, with or without `run`), so
// the limit cannot be dodged one part at a time. Commands scoped to a
// file (`pnpm exec jest <path>`, `pnpm exec eslint <path>`) and
// `pnpm format` stay allowed.

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const AGENT = "implement-issue";
export const LIMIT = 3;

// INFO: `pnpm` only counts in command position (start of the command or right
// after ; & | ( or a newline), so a grep pattern or an echo argument that
// mentions it does not. Root-wide flags before the script name are skipped,
// so `pnpm -w test` still counts as the gate's part.
const HEAD = String.raw`(?:^|[;&|(\n])\s*pnpm`;
const ROOT_FLAGS = String.raw`(?:\s+(?:-r|-w|--recursive|--workspace-root|--if-present|--silent|-s))*`;
const GATE = new RegExp(String.raw`${HEAD}${ROOT_FLAGS}\s+(?:run\s+)?gate(?![\w:-])`);
const PART = new RegExp(
  String.raw`${HEAD}${ROOT_FLAGS}\s+(?:run\s+)?(typecheck|lint|test)(?![\w:-])`,
);

export function classify(command) {
  if (GATE.test(command)) return { kind: "gate" };
  const part = PART.exec(command);
  if (part) return { kind: "part", part: part[1] };
  return { kind: "other" };
}

function deny(reason) {
  return {
    hookSpecificOutput: {
      hookEventName: "PreToolUse",
      permissionDecision: "deny",
      permissionDecisionReason: reason,
    },
  };
}

function hint(part) {
  if (part === "lint") return "`pnpm exec eslint <path>`";
  if (part === "test") return "`pnpm exec jest <path>`";
  return null;
}

// Returns the hook output object to print, or null to let the call pass.
export function decide(input, projectDir) {
  if (input?.agent_type !== AGENT) return null;
  if (input.tool_name !== undefined && input.tool_name !== "Bash") return null;
  const command = input.tool_input?.command;
  if (typeof command !== "string") return null;

  const found = classify(command);
  if (found.kind === "other") return null;

  if (found.kind === "part") {
    const scoped = hint(found.part);
    const alternative = scoped ? `, or scope the command to a file (${scoped})` : "";
    return deny(
      `Blocked: \`pnpm ${found.part}\` is part of the gate, and the gate is limited to ${LIMIT} attempts per run. Run \`pnpm gate\`${alternative}.`,
    );
  }

  const dir = path.join(projectDir, ".claude", "loop");
  const id = String(input.agent_id ?? "unknown").replace(/[^\w-]/g, "_");
  const file = path.join(dir, `gate-count-${id}.json`);
  let count = 0;
  try {
    count = JSON.parse(readFileSync(file, "utf8")).count;
  } catch (error) {
    if (error?.code !== "ENOENT") throw error;
  }
  if (count >= LIMIT) {
    return deny(
      `Blocked: the gate already ran ${LIMIT} times in this run. STOP retrying: do not run it again. Hand back with the failing output, what you tried, and the next stage per "The local gate".`,
    );
  }
  mkdirSync(dir, { recursive: true });
  writeFileSync(file, JSON.stringify({ count: count + 1 }));
  return null;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const raw = readFileSync(0, "utf8");
  const projectDir =
    process.env.CLAUDE_PROJECT_DIR ??
    path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
  const output = decide(JSON.parse(raw), projectDir);
  if (output) process.stdout.write(JSON.stringify(output));
}
