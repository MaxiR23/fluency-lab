// INFO: node --test over scripts/gate-limit.mjs. Each case feeds a stdin
// fixture shaped like the PreToolUse hook input and checks the output.

import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { after, before, describe, it } from "node:test";
import { fileURLToPath } from "node:url";

const script = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../gate-limit.mjs");

let projectDir;
before(() => {
  projectDir = mkdtempSync(path.join(tmpdir(), "gate-limit-"));
});
after(() => {
  rmSync(projectDir, { recursive: true, force: true });
});

function run(command, { agentType = "implement-issue", agentId = "agent-a" } = {}) {
  const input = {
    hook_event_name: "PreToolUse",
    tool_name: "Bash",
    tool_input: { command },
    ...(agentType ? { agent_type: agentType, agent_id: agentId } : {}),
  };
  const result = spawnSync("node", [script], {
    input: JSON.stringify(input),
    env: { ...process.env, CLAUDE_PROJECT_DIR: projectDir },
    encoding: "utf8",
  });
  assert.equal(result.status, 0, result.stderr);
  if (result.stdout === "") return { denied: false };
  const out = JSON.parse(result.stdout).hookSpecificOutput;
  assert.equal(out.hookEventName, "PreToolUse");
  return { denied: out.permissionDecision === "deny", reason: out.permissionDecisionReason };
}

describe("gate-limit", () => {
  it("lets three gate calls run and blocks the fourth with a stop-and-report reason", () => {
    for (let i = 0; i < 3; i += 1)
      assert.equal(run("pnpm gate", { agentId: "limit" }).denied, false);
    const fourth = run("pnpm gate", { agentId: "limit" });
    assert.equal(fourth.denied, true);
    assert.match(fourth.reason, /STOP/);
    assert.match(fourth.reason, /failing output/);
    assert.equal(run("pnpm gate", { agentId: "limit" }).denied, true);
  });

  it("counts piped, chained and `run` forms as gate calls", () => {
    const id = "forms";
    assert.equal(run("pnpm gate 2>&1 | tail", { agentId: id }).denied, false);
    assert.equal(run("pnpm run gate", { agentId: id }).denied, false);
    assert.equal(run("cd /repo && pnpm gate; echo done", { agentId: id }).denied, false);
    assert.equal(run("pnpm gate", { agentId: id }).denied, true);
  });

  it("blocks the gate's parts at the root, with or without run", () => {
    for (const part of ["typecheck", "lint", "test"]) {
      assert.equal(run(`pnpm ${part}`).denied, true, part);
      assert.equal(run(`pnpm run ${part}`).denied, true, `run ${part}`);
    }
    assert.equal(run("pnpm test -- foo 2>&1 | tail").denied, true);
  });

  it("blocks root-wide flag forms of the parts", () => {
    for (const command of [
      "pnpm -r run typecheck",
      "pnpm -r --if-present run test",
      "pnpm -w test",
      "pnpm --filter @fluency-lab/mobile test",
      "pnpm -F mobile run lint",
      "pnpm -C apps/mobile test",
      "pnpm --dir apps/mobile lint",
      "pnpm --dir=apps/mobile typecheck",
      "pnpm --workspace-concurrency=1 -r test",
    ])
      assert.equal(run(command).denied, true, command);
  });

  it("suggests a file scoped command for a blocked lint or test", () => {
    assert.match(run("pnpm lint").reason, /pnpm exec eslint <path>/);
    assert.match(run("pnpm test").reason, /pnpm exec jest <path>/);
    assert.match(run("pnpm test").reason, /pnpm exec vitest run <path>/);
    assert.doesNotMatch(run("pnpm test").reason, /--filter/);
  });

  it("points a blocked typecheck to the gate only", () => {
    const reason = run("pnpm typecheck").reason;
    assert.match(reason, /Run `pnpm gate`\.$/);
    assert.doesNotMatch(reason, /scope the command/);
  });

  it("does not count or block text that only mentions the gate or its parts", () => {
    const id = "text";
    for (const command of [
      'grep -n "pnpm gate" CLAUDE.md',
      "grep -n 'pnpm gate' x",
      "echo pnpm gate",
      'grep -rn "pnpm test" docs/testing.md',
      'rg "pnpm typecheck" .',
    ])
      assert.equal(run(command, { agentId: id }).denied, false, command);
    assert.equal(
      existsSync(path.join(projectDir, ".claude", "loop", `gate-count-${id}.json`)),
      false,
    );
    for (let i = 0; i < 3; i += 1) assert.equal(run("pnpm gate", { agentId: id }).denied, false);
  });

  it("blocked parts do not consume gate attempts", () => {
    const id = "parts";
    run("pnpm lint", { agentId: id });
    for (let i = 0; i < 3; i += 1) assert.equal(run("pnpm gate", { agentId: id }).denied, false);
  });

  it("lets file scoped commands run", () => {
    for (const command of [
      "pnpm exec jest apps/mobile/test/app/index.test.tsx",
      "pnpm exec vitest run packages/shared/test/probe.test.ts",
      "pnpm exec eslint apps/mobile/src/app/index.tsx",
      "pnpm format",
      "pnpm exec commitlint --help",
      "git status",
    ]) {
      assert.equal(run(command, { agentId: "scoped" }).denied, false, command);
    }
  });

  it("starts a new count for a new agent_id", () => {
    for (let i = 0; i < 3; i += 1) run("pnpm gate", { agentId: "first" });
    assert.equal(run("pnpm gate", { agentId: "first" }).denied, true);
    assert.equal(run("pnpm gate", { agentId: "second" }).denied, false);
  });

  it("never limits the main session or other agents", () => {
    for (let i = 0; i < 6; i += 1) {
      assert.equal(run("pnpm gate", { agentType: null }).denied, false);
      assert.equal(run("pnpm gate", { agentType: "review-changes", agentId: "r" }).denied, false);
    }
    assert.equal(run("pnpm test", { agentType: null }).denied, false);
  });

  it("ignores non-Bash tools", () => {
    const result = spawnSync("node", [script], {
      input: JSON.stringify({
        tool_name: "Read",
        tool_input: { file_path: "pnpm gate" },
        agent_type: "implement-issue",
        agent_id: "read",
      }),
      env: { ...process.env, CLAUDE_PROJECT_DIR: projectDir },
      encoding: "utf8",
    });
    assert.equal(result.stdout, "");
  });
});
