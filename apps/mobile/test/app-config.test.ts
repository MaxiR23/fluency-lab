// apps/mobile/test/app-config.test.ts
//
// Tests for the native app config: the tokens it matches and the build variants.
//
// Tested:
// - The root view background in the app config is the background token
// - Sign in with Apple on in the normal build and off in the personal build
// - Only the lowercase "personal" variant turns it off
// - The default export reads APP_VARIANT from the environment
// - The personal build strips the Sign in with Apple entitlement
// - The normal build registers no entitlements mod
//
// What is covered:
// - Normal case, empty case, edges
//
// Run with: pnpm exec jest apps/mobile/test/app-config.test.ts
//
// SEE: apps/mobile/app.config.ts

import { afterEach, describe, expect, it } from "@jest/globals";

import config, { appConfigFor, withoutAppleSignInEntitlement } from "../app.config";
import { colors } from "@/constants/theme";

function pluginNames(variant: string | undefined): string[] {
  return (appConfigFor(variant).plugins ?? []).map((plugin) =>
    typeof plugin === "string" ? plugin : String(plugin[0]),
  );
}

describe("app config", () => {
  it("sets the root view background to the background token", () => {
    expect(appConfigFor(undefined).backgroundColor).toBe(colors.background);
  });

  it("sets the root view background to black", () => {
    expect(appConfigFor(undefined).backgroundColor).toBe("#000000");
  });
});

describe("appConfigFor", () => {
  it("turns Sign in with Apple on when APP_VARIANT is unset", () => {
    const result = appConfigFor(undefined);
    expect(result.ios?.usesAppleSignIn).toBe(true);
    expect(pluginNames(undefined)).toContain("expo-apple-authentication");
    expect(result.extra?.appleSignIn).toBe(true);
  });

  it("turns the capability, the plugin and the flag off for the personal variant", () => {
    const result = appConfigFor("personal");
    expect(result.ios?.usesAppleSignIn).toBe(false);
    expect(pluginNames("personal")).not.toContain("expo-apple-authentication");
    expect(result.extra?.appleSignIn).toBe(false);
  });

  it("changes nothing else for the personal variant", () => {
    const normal = appConfigFor(undefined);
    const expected = {
      ...normal,
      ios: { ...normal.ios, usesAppleSignIn: false },
      plugins: (normal.plugins ?? []).filter(
        (plugin) =>
          (typeof plugin === "string" ? plugin : plugin[0]) !== "expo-apple-authentication",
      ),
      extra: { ...normal.extra, appleSignIn: false },
    };
    expect(appConfigFor("personal")).toEqual(expected);
  });

  it("keeps the plugin order of the personal variant otherwise", () => {
    expect(pluginNames("personal")).toEqual([
      "expo-router",
      "expo-splash-screen",
      "expo-sqlite",
      "expo-secure-store",
      "expo-localization",
    ]);
  });

  it("treats an empty APP_VARIANT as the normal build", () => {
    expect(appConfigFor("")).toEqual(appConfigFor(undefined));
  });

  it("treats any other variant as the normal build", () => {
    expect(appConfigFor("production")).toEqual(appConfigFor(undefined));
  });

  it("matches the personal variant only in lowercase", () => {
    expect(appConfigFor("Personal").extra?.appleSignIn).toBe(true);
  });
});

describe("withoutAppleSignInEntitlement", () => {
  it("removes the Sign in with Apple key and keeps the others", () => {
    expect(
      withoutAppleSignInEntitlement({
        "com.apple.developer.applesignin": ["Default"],
        "aps-environment": "development",
      }),
    ).toEqual({ "aps-environment": "development" });
  });

  it("returns an empty object for empty entitlements", () => {
    expect(withoutAppleSignInEntitlement({})).toEqual({});
  });

  it("returns the same keys when the Apple key is absent", () => {
    expect(withoutAppleSignInEntitlement({ "aps-environment": "development" })).toEqual({
      "aps-environment": "development",
    });
  });

  it("does not change its input", () => {
    const input = { "com.apple.developer.applesignin": ["Default"] };
    withoutAppleSignInEntitlement(input);
    expect(input).toHaveProperty(["com.apple.developer.applesignin"]);
  });

  it("removes only the exact key", () => {
    expect(
      withoutAppleSignInEntitlement({ "com.apple.developer.applesignin.extra": true }),
    ).toEqual({
      "com.apple.developer.applesignin.extra": true,
    });
  });
});

describe("default export", () => {
  const savedVariant = process.env.APP_VARIANT;

  afterEach(() => {
    if (savedVariant === undefined) delete process.env.APP_VARIANT;
    else process.env.APP_VARIANT = savedVariant;
  });

  it("reads APP_VARIANT from the environment for the personal build", () => {
    process.env.APP_VARIANT = "personal";
    expect(config().extra?.appleSignIn).toBe(false);
  });

  it("builds the normal config when APP_VARIANT is not set", () => {
    delete process.env.APP_VARIANT;
    expect(config().extra?.appleSignIn).toBe(true);
  });

  it("registers the entitlements mod for the personal build", () => {
    process.env.APP_VARIANT = "personal";
    expect(config()).toHaveProperty("mods.ios.entitlements");
  });

  it("registers no mod for the normal build", () => {
    delete process.env.APP_VARIANT;
    expect(config()).not.toHaveProperty("mods");
  });
});
