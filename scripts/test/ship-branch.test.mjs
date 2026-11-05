// scripts/test/ship-branch.test.mjs
//
// Tests for the branch naming logic of scripts/ship.sh.
//
// Tested:
// - branch_slug: titles under, at and over 5 words, punctuation, uppercase, empty
// - branch_is_valid: the seven types, w_ branches, unknown prefix, empty description
// - prepare: stops on an empty description before fetching or switching, creates
//   <type>/<description> from main, stops on a w_ branch, an unknown prefix and
//   an empty description, stops from main when the branch exists on origin
//   (with or without an open PR) naming the branch it queried, stops from main
//   when ls-remote fails, keeps working on the issue's own branch
// - publish: stops on a w_ branch, an unknown prefix and an empty description,
//   without pushing
//
// What is covered:
// - Normal case, empty case, edges
//
// Run with: node --test scripts/test/ship-branch.test.mjs
//
// SEE: scripts/ship.sh

import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import {
  chmodSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

const script = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../ship.sh");

const bash = (code, env = {}, args = []) =>
  spawnSync("bash", ["-c", `source "${script}"; ${code}`, "bash", ...args], {
    encoding: "utf8",
    env: { ...process.env, ...env },
  });

const slug = (title) => bash('branch_slug "$1"', {}, [title]).stdout;
const valid = (branch) => bash('branch_is_valid "$1"', {}, [branch]).status === 0;

describe("branch_slug", () => {
  it("keeps a title under 5 words whole", () => {
    assert.equal(slug("feat(x): add login screen"), "add-login-screen\n");
  });

  it("keeps a title of exactly 5 words whole", () => {
    assert.equal(slug("feat(x): one two three four five"), "one-two-three-four-five\n");
  });

  it("keeps only the first 5 words of a longer title", () => {
    assert.equal(slug("feat(x): one two three four five six seven"), "one-two-three-four-five\n");
  });

  it("lowercases and drops punctuation", () => {
    assert.equal(slug("fix(x): Handle API's  Errors, NOW!"), "handle-api-s-errors-now\n");
  });

  it("yields an empty description for a title with only the prefix", () => {
    assert.equal(slug("feat(x): ").trim(), "");
    assert.equal(slug("feat(x): !!!").trim(), "");
  });
});

describe("branch_is_valid", () => {
  for (const type of ["feat", "fix", "chore", "docs", "test", "refactor", "ci"]) {
    it(`accepts the ${type} type`, () => {
      assert.equal(valid(`${type}/some-thing`), true);
    });
  }

  it("rejects a w_ branch", () => {
    assert.equal(valid("w_261105_feat_login"), false);
  });

  it("rejects a prefix outside the seven types", () => {
    assert.equal(valid("feature/login"), false);
    assert.equal(valid("main"), false);
  });

  it("rejects an empty description", () => {
    assert.equal(valid("feat/"), false);
  });
});

// Runs `ship.sh <args>` in a temporary directory with fake gh, git and pnpm.
// gh answers the label and the title given; git logs every call and reports
// the current branch given; git ls-remote prints remoteHeads, or fails when
// lsRemoteFails is set; gh answers the open PR count and number from openPr;
// pnpm always fails so no real gate ever runs.
const runShip = ({
  args,
  branch = "",
  title = "",
  label = "feat",
  files = {},
  remoteHeads = "",
  openPr = "",
  lsRemoteFails = false,
}) => {
  const dir = mkdtempSync(path.join(tmpdir(), "ship-branch-"));
  try {
    const fake = (name, body) => {
      const file = path.join(dir, name);
      writeFileSync(file, `#!/usr/bin/env bash\n${body}\n`);
      chmodSync(file, 0o755);
    };
    fake(
      "gh",
      `case "$*" in
  *labels*) echo "$GH_LABEL" ;;
  *length*) if [ -n "$GH_PR" ]; then echo 1; else echo 0; fi ;;
  *number*) echo "$GH_PR" ;;
  *) echo "$GH_TITLE" ;;
esac`,
    );
    fake(
      "git",
      `echo "git $*" >> "$GIT_LOG"
case "$1" in
  branch) echo "$GIT_BRANCH" ;;
  ls-remote) [ -z "$GIT_LS_REMOTE_FAIL" ] || exit 1; echo "$GIT_REMOTE_HEADS" ;;
esac`,
    );
    fake("pnpm", "exit 1");
    for (const [name, content] of Object.entries(files)) {
      mkdirSync(path.dirname(path.join(dir, name)), { recursive: true });
      writeFileSync(path.join(dir, name), content);
    }
    const log = path.join(dir, "git.log");
    const result = spawnSync("bash", ["-c", `source "${script}"; ${args}`], {
      encoding: "utf8",
      cwd: dir,
      env: {
        ...process.env,
        PATH: `${dir}:${process.env.PATH}`,
        GIT_LOG: log,
        GIT_BRANCH: branch,
        GH_TITLE: title,
        GH_LABEL: label,
        GIT_REMOTE_HEADS: remoteHeads,
        GH_PR: openPr,
        GIT_LS_REMOTE_FAIL: lsRemoteFails ? "1" : "",
      },
    });
    return {
      status: result.status,
      stderr: result.stderr,
      log: existsSync(log) ? readFileSync(log, "utf8") : "",
    };
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
};

const invalidBranches = ["w_261105_feat_login", "feature/login", "feat/"];

describe("prepare", () => {
  it("stops on an empty description before fetching or creating any branch", () => {
    const result = runShip({ args: "prepare 1", branch: "main", title: "feat(x): !!!" });
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /empty branch description/);
    assert.doesNotMatch(result.log, /fetch|switch/);
  });

  it("creates <type>/<description> from main", () => {
    const result = runShip({
      args: "prepare 1",
      branch: "main",
      title: "feat(x): Add Login Screen",
    });
    assert.match(result.log, /^git switch -c feat\/add-login-screen$/m);
  });

  for (const [name, openPr] of [
    ["without an open PR", ""],
    ["with an open PR", "7"],
  ]) {
    it(`stops from main when the branch exists on origin ${name}`, () => {
      const result = runShip({
        args: "prepare 1",
        branch: "main",
        title: "feat(x): Add Login Screen",
        remoteHeads: "abc123\trefs/heads/feat/add-login-screen",
        openPr,
      });
      assert.notEqual(result.status, 0);
      assert.match(result.stderr, /already exists on origin/);
      assert.match(result.stderr, /if it is stale/);
      assert.match(result.stderr, /switch to it and run prepare there/);
      assert.match(result.log, /^git ls-remote --heads origin feat\/add-login-screen$/m);
      assert.doesNotMatch(result.log, /switch/);
    });
  }

  it("stops from main when git ls-remote fails, before creating any branch", () => {
    const result = runShip({
      args: "prepare 1",
      branch: "main",
      title: "feat(x): Add Login Screen",
      lsRemoteFails: true,
    });
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /could not read the branches on origin/);
    assert.doesNotMatch(result.stderr, /already exists on origin/);
    assert.doesNotMatch(result.log, /switch/);
  });

  it("does not stop on the issue's own pushed branch", () => {
    const result = runShip({
      args: "prepare 1",
      branch: "feat/add-login-screen",
      title: "feat(x): Add Login Screen",
      remoteHeads: "abc123\trefs/heads/feat/add-login-screen",
      openPr: "7",
    });
    assert.doesNotMatch(result.stderr, /already exists on origin/);
    assert.match(result.stderr, /does not pass commitlint/);
  });

  for (const branch of invalidBranches) {
    it(`stops on the invalid branch ${branch}`, () => {
      const result = runShip({ args: "prepare 1", branch, title: "feat(x): Add Login" });
      assert.notEqual(result.status, 0);
      assert.match(result.stderr, /not on main nor on a <type>\/<description> branch/);
    });
  }
});

describe("publish", () => {
  for (const branch of invalidBranches) {
    it(`stops on the invalid branch ${branch} without pushing`, () => {
      const result = runShip({
        args: "publish 1",
        files: {
          ".claude/loop/pr-1.meta": `Title: feat(x): Add Login\nLabel: feat\nBranch: ${branch}\nCommit: abc\nMode: create\n`,
          ".claude/loop/pr-1.body.md": "Closes #1\n\nBody.\n",
        },
      });
      assert.notEqual(result.status, 0);
      assert.match(result.stderr, /not a <type>\/<description> branch/);
      assert.doesNotMatch(result.log, /push/);
    });
  }
});
