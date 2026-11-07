import { withHost } from "@/utils/api-env";
import { hasText } from "@/utils/has-text";

export function readSupabaseEnv(input: {
  url: string | undefined;
  publishableKey: string | undefined;
  host?: string | null;
}): {
  url: string;
  publishableKey: string;
} {
  if (input.url === undefined || !hasText(input.url)) {
    throw new Error("Missing EXPO_PUBLIC_SUPABASE_URL");
  }
  if (input.publishableKey === undefined || !hasText(input.publishableKey)) {
    throw new Error("Missing EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY");
  }
  return { url: withHost(input.url, input.host ?? null), publishableKey: input.publishableKey };
}
