// apps/api/test/migrations.test.ts
//
// Tests that the SQL migrations and the shared value lists agree.
//
// Tested:
// - Every level, goal, provider, session status and message role of
//   packages/shared appears quoted in the migrations
// - Every practice focus and practice kind appears quoted too
// - Row level security is enabled on profiles, sessions, messages, thread_messages,
//   practice_runs, practice_items, practice_checks and study_notes
// - Every practice check stage appears quoted in the migrations
// - Every note kind appears quoted in the migrations
// - Every title source appears quoted in the migrations
//
// What is covered:
// - Normal case, empty case, edges
//
// Run with: pnpm exec vitest run apps/api/test/migrations.test.ts
//
// SEE: supabase/migrations

import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import {
  GOALS,
  LEVELS,
  MESSAGE_ROLES,
  NOTE_KINDS,
  PRACTICE_CHECK_STAGES,
  PRACTICE_FOCUSES,
  PRACTICE_KINDS,
  PROVIDERS,
  SESSION_STATUSES,
  TITLE_SOURCES,
} from "@fluency-lab/shared";
import { describe, expect, it } from "vitest";

const dir = path.resolve(import.meta.dirname, "../../../supabase/migrations");
const sql = readdirSync(dir)
  .filter((name) => name.endsWith(".sql"))
  .map((name) => readFileSync(path.join(dir, name), "utf8"))
  .join("\n");

function missing(values: readonly string[]): string[] {
  return values.filter((value) => !sql.includes(`'${value}'`));
}

describe("migrations", () => {
  it("has at least one migration", () => {
    expect(sql.trim()).not.toBe("");
  });

  it("lists every level, goal and provider", () => {
    expect(missing([...LEVELS, ...GOALS, ...PROVIDERS])).toEqual([]);
  });

  it("lists every session status and message role", () => {
    expect(missing([...SESSION_STATUSES, ...MESSAGE_ROLES])).toEqual([]);
  });

  it("lists every title source", () => {
    expect(missing([...TITLE_SOURCES])).toEqual([]);
  });

  it("lists every practice focus and practice kind", () => {
    expect(missing([...PRACTICE_FOCUSES, ...PRACTICE_KINDS])).toEqual([]);
  });

  it("lists every practice check stage", () => {
    expect(missing([...PRACTICE_CHECK_STAGES])).toEqual([]);
  });

  it("lists every note kind", () => {
    expect(missing([...NOTE_KINDS])).toEqual([]);
  });

  it("enables row level security on the tables", () => {
    for (const table of [
      "profiles",
      "sessions",
      "messages",
      "thread_messages",
      "practice_runs",
      "practice_items",
      "practice_checks",
      "study_notes",
    ]) {
      expect(sql).toMatch(
        new RegExp(`alter table public\\.${table} enable row level security`, "i"),
      );
    }
  });
});
