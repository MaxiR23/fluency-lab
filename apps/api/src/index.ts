import { serve } from "@hono/node-server";
import { createApp } from "./app";
import { authConfigFromEnv } from "./auth";

const app = createApp({ auth: authConfigFromEnv(process.env, fetch) });
serve({ fetch: app.fetch, port: 3000 });
