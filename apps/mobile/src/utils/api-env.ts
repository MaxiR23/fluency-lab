import { hasText } from "@/utils/has-text";

export function readApiUrl(value: string | undefined): string {
  if (value === undefined || !hasText(value)) throw new Error("Missing EXPO_PUBLIC_API_URL");
  return value.trim().replace(/\/$/, "");
}
