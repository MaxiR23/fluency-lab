import { hasText } from "@/utils/has-text";

const PORT = /^\d+$/;
const PLAIN_HOST = /^[A-Za-z0-9.-]+$/;
const BRACKET_INSIDE = /^[0-9A-Fa-f:.]+$/;

// INFO: Metro's hostUri has the form host:port. Outside development, or for a
// value that is not that form, there is no host to use and the env URL stays.
export function metroHost(dev: boolean, hostUri: string | undefined): string | null {
  if (!dev || hostUri === undefined) return null;
  const value = hostUri.trim();
  if (value === "") return null;
  if (value.startsWith("[")) {
    const close = value.indexOf("]");
    if (close === -1) return null;
    const inside = value.slice(1, close);
    const after = value.slice(close + 1);
    if (!BRACKET_INSIDE.test(inside)) return null;
    if (after !== "" && !(after.startsWith(":") && PORT.test(after.slice(1)))) return null;
    return value.slice(0, close + 1);
  }
  const parts = value.split(":");
  if (parts.length > 2) return null;
  const [host, port] = parts;
  if (host === undefined || !PLAIN_HOST.test(host)) return null;
  if (port !== undefined && !PORT.test(port)) return null;
  return host;
}

// INFO: React Native's URL has no host setter, so the host is replaced as text.
export function withHost(url: string, host: string | null): string {
  if (host === null) return url;
  const match = /^([A-Za-z][A-Za-z0-9+.-]*:\/\/)(\[[^\]]*\]|[^:/?#]*)(.*)$/.exec(url);
  if (match === null) return url;
  return `${match[1]}${host}${match[3]}`;
}

export function readApiUrl(value: string | undefined, host: string | null = null): string {
  if (value === undefined || !hasText(value)) throw new Error("Missing EXPO_PUBLIC_API_URL");
  return withHost(value.trim().replace(/\/$/, ""), host);
}
