import type { ActiveSession } from "@fluency-lab/shared";
import { sessionTitle } from "@fluency-lab/shared";

import type { IconName } from "@/components/icon";
import { relativeTime } from "@/utils/relative-time";
import { sessionIcon } from "@/utils/topic-icon";

const MORNING_START = 5;
const AFTERNOON_START = 12;
const EVENING_START = 18;

function dayPart(hour: number): string {
  if (hour >= MORNING_START && hour < AFTERNOON_START) return "Good morning";
  if (hour >= AFTERNOON_START && hour < EVENING_START) return "Good afternoon";
  return "Good evening";
}

export function greeting(displayName: string | null, at: Date): string {
  const name = displayName?.trim() ?? "";
  const part = dayPart(at.getHours());
  return name === "" ? part : `${part}, ${name}`;
}

export function avatarInitial(displayName: string | null): string | null {
  const first = Array.from(displayName?.trim() ?? "")[0];
  return first === undefined ? null : first.toUpperCase();
}

export function continueCard(
  active: ActiveSession,
  now: number,
): { title: string; meta: string; icon: IconName } {
  const time = relativeTime(active.lastMessage?.createdAt ?? active.session.updatedAt, now);
  const parts = [sessionTitle(active.session.topicId), time];
  return {
    title: active.session.title,
    meta: parts.filter((part) => part !== null).join(" · "),
    icon: sessionIcon(active.session.topicId),
  };
}

export function seeAllLabel(openCount: number): string | null {
  return openCount <= 1 ? null : `See all (${openCount})`;
}
