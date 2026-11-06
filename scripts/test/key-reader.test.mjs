// scripts/test/key-reader.test.mjs
//
// Test that only the AI wiring reads the user's API key.
//
// Tested:
// - readApiKey appears only in the key port, its adapter and src/ai/index.ts
//
// What is covered:
// - Normal case: the three allowed files
// - Edge: a screen, hook or component that reads the key fails the test
//
// Run with: node --test scripts/test/key-reader.test.mjs
//
// SEE: apps/mobile/src/ai/index.ts

import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const source = path.join(root, "apps/mobile/src");

describe("who reads the key", () => {
  it("only the AI wiring calls readApiKey", () => {
    const users = readdirSync(source, { recursive: true, withFileTypes: true })
      .filter((entry) => entry.isFile())
      .map((entry) => path.join(entry.parentPath, entry.name))
      .filter((file) => readFileSync(file, "utf8").includes("readApiKey"))
      .map((file) => path.relative(source, file).split(path.sep).join("/"))
      .sort();

    assert.deepEqual(users, ["ai/index.ts", "keys/key-port.ts", "keys/secure-store-keys.ts"]);
  });
});
