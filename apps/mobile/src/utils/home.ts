import type { ActiveSession } from "@fluency-lab/shared";

import { relativeTime } from "@/utils/relative-time";

export function greeting(displayName: string | null): string {
  const name = displayName?.trim() ?? "";
  return name === "" ? "Hi" : `Hi, ${name}`;
}

export function continueCard(
  active: ActiveSession,
  now: number,
): { title: string; preview: string; time: string | null } {
  return {
    title: active.session.title,
    preview: active.lastMessage?.text ?? "No messages yet",
    time: relativeTime(active.lastMessage?.createdAt ?? active.session.updatedAt, now),
  };
}
