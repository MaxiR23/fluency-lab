import { serve } from "@hono/node-server";
import { createApp } from "./app";
import { authConfigFromEnv } from "./auth";
import { createSupabaseStore, storeConfigFromEnv } from "./supabase-store";

const app = createApp({
  auth: authConfigFromEnv(process.env, fetch),
  store: createSupabaseStore(storeConfigFromEnv(process.env, fetch)),
});
serve({ fetch: app.fetch, port: 3000 });
