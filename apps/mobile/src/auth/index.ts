import "expo-sqlite/localStorage/install";

import { createClient } from "@supabase/supabase-js";
import { AppState } from "react-native";

import type { AuthPort } from "@/auth/auth-port";
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
