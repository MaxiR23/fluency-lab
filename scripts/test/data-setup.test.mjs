// scripts/test/data-setup.test.mjs
//
// Tests for the data boundary of the app.
//
// Tested:
// - No screen or shared component imports the Hono client or the api package
// - Only the data composition root and its adapter do
// - apps/api and apps/mobile declare the same hono range
//
// What is covered:
// - Normal case, empty case, edges
//
// Run with: node --test scripts/test/data-setup.test.mjs
//
// SEE: apps/mobile/src/data/hono-data.ts

import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

function read(relative) {
  return readFileSync(path.join(root, relative), "utf8");
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

function filesUsingHono(relative) {
  return sourceFiles(relative).filter((file) => {
    const text = readFileSync(file, "utf8");
    return /from "hono(\/[^"]*)?"/.test(text) || /from "api"/.test(text);
  });
}

describe("the data boundary", () => {
  it("has no hono or api import under src/app or src/components", () => {
    assert.deepEqual(filesUsingHono("apps/mobile/src/app"), []);
    assert.deepEqual(filesUsingHono("apps/mobile/src/components"), []);
  });

  it("sees the hono imports of the data adapter with the same check", () => {
    const found = filesUsingHono("apps/mobile/src/data").map((file) => path.relative(root, file));
    assert.deepEqual(found, ["apps/mobile/src/data/hono-data.ts"]);
  });
});

describe("the hono version", () => {
  it("is the same range in apps/api and apps/mobile", () => {
    const api = JSON.parse(read("apps/api/package.json"));
    const mobile = JSON.parse(read("apps/mobile/package.json"));
    assert.ok(api.dependencies.hono);
    assert.equal(mobile.dependencies.hono, api.dependencies.hono);
  });
});
