// scripts/test/auth-setup.test.mjs
//
// Tests for the local Supabase setup and the auth boundary.
//
// Tested:
// - The root scripts that start, stop and report the stack, and the pinned CLI
// - The Apple and email providers in supabase/config.toml
// - The recovery email template: a code, no link
// - No supabase-js import in screens or components
// - The env examples and the ignore rules
//
// What is covered:
// - Normal case, empty case, edges
//
// Run with: node --test scripts/test/auth-setup.test.mjs
//
// SEE: supabase/config.toml

import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

function read(relative) {
  return readFileSync(path.join(root, relative), "utf8");
}

function section(toml, header) {
  const start = toml.indexOf(`[${header}]`);
  assert.notEqual(start, -1, `missing [${header}]`);
  const rest = toml.slice(start + header.length + 2);
  const next = rest.search(/^\[/m);
  return next === -1 ? rest : rest.slice(0, next);
}

function sourceFiles(relative) {
  const dir = path.join(root, relative);
  const out = [];
  for (const name of readdirSync(dir)) {
    const full = path.join(dir, name);
    if (statSync(full).isDirectory()) out.push(...sourceFiles(path.join(relative, name)));
    else out.push(full);
  }
  return out;
}

function filesImportingSupabase(relative) {
  return sourceFiles(relative).filter((file) => readFileSync(file, "utf8").includes("@supabase/"));
}

function gitCheckIgnore(relative) {
  return spawnSync("git", ["check-ignore", "-q", relative], { cwd: root }).status === 0;
}

function envKeys(relative) {
  return read(relative)
    .split("\n")
    .filter((line) => line.trim() !== "" && !line.startsWith("#"));
}

describe("local Supabase scripts", () => {
  const pkg = JSON.parse(read("package.json"));

  it("has root scripts that start, stop and report the status of the stack", () => {
    assert.equal(pkg.scripts["supabase:start"], "supabase start");
    assert.equal(pkg.scripts["supabase:stop"], "supabase stop");
    assert.equal(pkg.scripts["supabase:status"], "supabase status");
  });

  it("keeps the supabase CLI pinned to an exact version", () => {
    assert.match(pkg.devDependencies.supabase, /^\d+\.\d+\.\d+$/);
  });
});

describe("supabase/config.toml", () => {
  const toml = read("supabase/config.toml");

  it("enables the Apple provider with both client IDs", () => {
    const apple = section(toml, "auth.external.apple");
    assert.match(apple, /^enabled = true$/m);
    assert.match(apple, /^client_id = "host\.exp\.Exponent,com\.maxirebolo\.fluencylab"$/m);
  });

  it("does not skip the Apple nonce check", () => {
    assert.match(section(toml, "auth.external.apple"), /^skip_nonce_check = false$/m);
  });

  it("enables email and password sign-in", () => {
    assert.match(section(toml, "auth"), /^enable_signup = true$/m);
    assert.match(section(toml, "auth.email"), /^enabled = true$/m);
  });
});

describe("the recovery email template", () => {
  it("sets the recovery subject and template path", () => {
    const recovery = section(read("supabase/config.toml"), "auth.email.template.recovery");
    assert.match(recovery, /^subject = "Your Fluency Lab reset code"$/m);
    assert.match(recovery, /^content_path = "\.\/supabase\/templates\/recovery\.html"$/m);
  });

  it("has a recovery template with the code and no link", () => {
    const html = read("supabase/templates/recovery.html");
    assert.match(html, /\{\{ \.Token \}\}/);
    assert.doesNotMatch(html, /ConfirmationURL/);
    assert.doesNotMatch(html, /href=/);
  });
});

describe("the auth boundary", () => {
  it("has no supabase-js import under src/app or src/components", () => {
    assert.deepEqual(filesImportingSupabase("apps/mobile/src/app"), []);
    assert.deepEqual(filesImportingSupabase("apps/mobile/src/components"), []);
  });

  it("sees the supabase-js import of the composition root with the same check", () => {
    const found = filesImportingSupabase("apps/mobile/src/auth").map((file) =>
      path.relative(root, file),
    );
    assert.deepEqual(found, ["apps/mobile/src/auth/index.ts"]);
  });
});

describe("env files", () => {
  it("has both env examples with empty values and only the expected keys", () => {
    assert.deepEqual(envKeys("apps/mobile/.env.example"), [
      "EXPO_PUBLIC_SUPABASE_URL=",
      "EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY=",
      "EXPO_PUBLIC_API_URL=",
    ]);
    assert.deepEqual(envKeys("apps/api/.env.example"), [
      "SUPABASE_URL=",
      "SUPABASE_PUBLISHABLE_KEY=",
    ]);
  });

  it("does not ignore the env examples", () => {
    assert.equal(gitCheckIgnore("apps/mobile/.env.example"), false);
    assert.equal(gitCheckIgnore("apps/api/.env.example"), false);
  });

  it("ignores .env.local in both apps", () => {
    assert.equal(gitCheckIgnore("apps/mobile/.env.local"), true);
    assert.equal(gitCheckIgnore("apps/api/.env.local"), true);
  });

  it("tracks no .env.local", () => {
    const tracked = spawnSync("git", ["ls-files", "--", "*.env.local", "*/.env.local"], {
      cwd: root,
      encoding: "utf8",
    }).stdout.trim();
    assert.equal(tracked, "");
  });

  it("ignores the supabase local state", () => {
    assert.equal(gitCheckIgnore("supabase/.temp/cli-latest"), true);
    assert.equal(gitCheckIgnore("supabase/.branches/_current_branch"), true);
  });
});
