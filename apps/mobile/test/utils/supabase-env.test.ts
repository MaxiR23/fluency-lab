// apps/mobile/test/utils/supabase-env.test.ts
//
// Tests for readSupabaseEnv.
//
// Tested:
// - The Supabase variables are read, and a missing one fails at load
// - The url takes Metro's host when one is given
//
// What is covered:
// - Normal case, empty case, edges
//
// Run with: pnpm exec jest apps/mobile/test/utils/supabase-env.test.ts
//
// SEE: apps/mobile/src/utils/supabase-env.ts

import { describe, expect, it } from "@jest/globals";

import { readSupabaseEnv } from "@/utils/supabase-env";

describe("readSupabaseEnv", () => {
  it("returns the url and the publishable key", () => {
    expect(readSupabaseEnv({ url: "http://host:1", publishableKey: "key-1" })).toEqual({
      url: "http://host:1",
      publishableKey: "key-1",
    });
  });

  it("throws naming EXPO_PUBLIC_SUPABASE_URL when the url is missing", () => {
    expect(() => readSupabaseEnv({ url: undefined, publishableKey: "key-1" })).toThrow(
      "EXPO_PUBLIC_SUPABASE_URL",
    );
  });

  it("throws naming EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY when the key is missing", () => {
    expect(() => readSupabaseEnv({ url: "http://host:1", publishableKey: undefined })).toThrow(
      "EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
    );
  });

  it("treats a blank value as missing", () => {
    expect(() => readSupabaseEnv({ url: "   ", publishableKey: "key-1" })).toThrow(
      "EXPO_PUBLIC_SUPABASE_URL",
    );
  });

  it("does not put a value in the error message", () => {
    expect(() => readSupabaseEnv({ url: "http://secret-host:1", publishableKey: " " })).toThrow(
      /^((?!secret-host).)*$/,
    );
  });

  it("puts the given host in the url and keeps its port", () => {
    expect(
      readSupabaseEnv({
        url: "http://192.168.1.88:54321",
        publishableKey: "key-1",
        host: "192.168.1.89",
      }),
    ).toEqual({ url: "http://192.168.1.89:54321", publishableKey: "key-1" });
  });

  it("keeps the url as it is without a host", () => {
    expect(
      readSupabaseEnv({ url: "http://192.168.1.88:54321", publishableKey: "key-1", host: null })
        .url,
    ).toBe("http://192.168.1.88:54321");
  });

  it("still throws for a missing url when a host is given", () => {
    expect(() =>
      readSupabaseEnv({ url: undefined, publishableKey: "key-1", host: "192.168.1.89" }),
    ).toThrow("EXPO_PUBLIC_SUPABASE_URL");
  });
});
