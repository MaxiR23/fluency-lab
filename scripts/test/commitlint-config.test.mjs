// scripts/test/commitlint-config.test.mjs
//
// Tests for the no-attribution rule of commitlint.config.js.
//
// Tested:
// - The file name CLAUDE.md is accepted
// - Claude, Anthropic, Co-Authored-By, Generated with and Claude-Session are rejected
// - A message with the file name and an attribution is rejected
//
// What is covered:
// - Normal case, empty case, edges
//
// Run with: node --test scripts/test/commitlint-config.test.mjs
//
// SEE: commitlint.config.js

import assert from "node:assert/strict";
import { describe, it } from "node:test";

import config from "../../commitlint.config.js";

const rule = config.plugins[0].rules["no-attribution"];
const passes = (raw) => rule({ raw })[0];

describe("no-attribution rule", () => {
  it("accepts a message that only names the file CLAUDE.md", () => {
    assert.equal(passes("docs(repo): update CLAUDE.md"), true);
  });

  it("accepts an empty or missing message", () => {
    assert.equal(passes(""), true);
    assert.equal(passes(undefined), true);
  });

  it("rejects the word Claude", () => {
    assert.equal(passes("feat(x): made with Claude"), false);
  });

  it("rejects a Co-Authored-By footer", () => {
    assert.equal(
      passes("feat(x): add a thing\n\nCo-Authored-By: Someone <noreply@example.com>"),
      false,
    );
  });

  it("accepts the file name inside a path", () => {
    assert.equal(passes("docs(repo): update apps/mobile/CLAUDE.md"), true);
  });

  it("rejects longer tokens that contain the file name", () => {
    assert.equal(passes("docs(repo): update CLAUDE.mdx"), false);
    assert.equal(passes("docs(repo): update XCLAUDE.md"), false);
    assert.equal(passes("feat(x): add a thing\n\nCLAUDE.md-Session: abc123"), false);
  });

  it("rejects a Claude-Session line", () => {
    assert.equal(passes("feat(x): add a thing\n\nClaude-Session: abc123"), false);
  });

  it("rejects a message with both the file name and an attribution", () => {
    assert.equal(passes("docs(repo): update CLAUDE.md, made with Claude"), false);
  });

  it("rejects Anthropic and Generated with", () => {
    assert.equal(passes("feat(x): thanks Anthropic"), false);
    assert.equal(passes("feat(x): Generated with a tool"), false);
  });
});
