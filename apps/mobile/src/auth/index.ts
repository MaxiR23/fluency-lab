import "expo-sqlite/localStorage/install";

import { createClient } from "@supabase/supabase-js";
import * as AppleAuthentication from "expo-apple-authentication";
import * as Crypto from "expo-crypto";
import { AppState } from "react-native";

import type { ApplePort, AuthPort } from "@/auth/auth-port";
import { createExpoApple } from "@/auth/expo-apple";
import { bindAutoRefresh, createSupabaseAuth, supabaseAuthOptions } from "@/auth/supabase-auth";
import { readSupabaseEnv } from "@/utils/supabase-env";

// INFO: Metro inlines EXPO_PUBLIC_ variables only when each is written in
// full as process.env.NAME, so they cannot be read through a variable.
const env = readSupabaseEnv({
  url: process.env.EXPO_PUBLIC_SUPABASE_URL,
  publishableKey: process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
});

const client = createClient(env.url, env.publishableKey, {
  auth: supabaseAuthOptions(localStorage),
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
