import "expo-sqlite/localStorage/install";

import { createClient } from "@supabase/supabase-js";
import * as AppleAuthentication from "expo-apple-authentication";
import Constants from "expo-constants";
import * as Crypto from "expo-crypto";
import { AppState } from "react-native";

import type { ApplePort, AuthPort } from "@/auth/auth-port";
import { createExpoApple } from "@/auth/expo-apple";
import {
  bindAutoRefresh,
  createSupabaseAuth,
  SUPABASE_REQUEST_TIMEOUT_MS,
  supabaseAuthOptions,
  withRequestDeadline,
} from "@/auth/supabase-auth";
import { appleSignInConfigured } from "@/utils/apple-sign-in";
import { metroHost } from "@/utils/api-env";
import { readSupabaseEnv } from "@/utils/supabase-env";

// INFO: Metro inlines EXPO_PUBLIC_ variables only when each is written in
// full as process.env.NAME, so they cannot be read through a variable.
const env = readSupabaseEnv({
  url: process.env.EXPO_PUBLIC_SUPABASE_URL,
  publishableKey: process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  host: metroHost(__DEV__, Constants.expoConfig?.hostUri),
});

const client = createClient(env.url, env.publishableKey, {
  auth: supabaseAuthOptions(localStorage),
  global: { fetch: withRequestDeadline(fetch, SUPABASE_REQUEST_TIMEOUT_MS) },
});

bindAutoRefresh(client.auth, AppState);

export const auth: AuthPort = createSupabaseAuth(client.auth);

export const apple: ApplePort = createExpoApple({
  lib: AppleAuthentication,
  scopes: [
    AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
    AppleAuthentication.AppleAuthenticationScope.EMAIL,
  ],
  randomId: Crypto.randomUUID,
  sha256Hex: (value) =>
    Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, value, {
      encoding: Crypto.CryptoEncoding.HEX,
    }),
});

// INFO: app.config.ts embeds extra.appleSignIn at build time; a personal build sets it false.
export const appleSignIn: boolean = appleSignInConfigured(Constants.expoConfig);
