// apps/api/test/migrations.test.ts
//
// Tests that the SQL migrations and the shared value lists agree.
//
// Tested:
// - Every topic id, level, goal, provider, session status and message role of
//   packages/shared appears quoted in the migrations
// - Row level security is enabled on profiles, sessions, messages and thread_messages
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
  PROVIDERS,
  SESSION_STATUSES,
  TOPIC_IDS,
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

  it("lists every topic id of the catalog in the migration", () => {
    expect(missing(TOPIC_IDS)).toEqual([]);
  });

  it("lists every level, goal and provider", () => {
    expect(missing([...LEVELS, ...GOALS, ...PROVIDERS])).toEqual([]);
  });

  it("lists every session status and message role", () => {
    expect(missing([...SESSION_STATUSES, ...MESSAGE_ROLES])).toEqual([]);
  });

  it("enables row level security on the four tables", () => {
    for (const table of ["profiles", "sessions", "messages", "thread_messages"]) {
      expect(sql).toMatch(
        new RegExp(`alter table public\\.${table} enable row level security`, "i"),
      );
    }
  });
});
