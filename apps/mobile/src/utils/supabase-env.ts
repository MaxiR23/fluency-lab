import { hasText } from "@/utils/has-text";

export function readSupabaseEnv(input: {
  url: string | undefined;
  publishableKey: string | undefined;
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
  return { url: input.url, publishableKey: input.publishableKey };
}
