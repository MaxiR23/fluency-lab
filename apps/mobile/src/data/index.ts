import Constants from "expo-constants";

import { auth } from "@/auth";
import type { DataPort } from "@/data/data-port";
import { createHonoData } from "@/data/hono-data";
import { metroHost, readApiUrl } from "@/utils/api-env";
import { toTokenRead } from "@/utils/data-token";

// INFO: Metro inlines EXPO_PUBLIC_ variables only when each is written in
// full as process.env.NAME, so they cannot be read through a variable.
export const data: DataPort = createHonoData({
  baseUrl: readApiUrl(
    process.env.EXPO_PUBLIC_API_URL,
    metroHost(__DEV__, Constants.expoConfig?.hostUri),
  ),
  fetchFn: fetch,
  readToken: async () => toTokenRead(await auth.currentSession()),
});
