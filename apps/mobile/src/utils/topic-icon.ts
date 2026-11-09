import { TOPIC_IDS, type Goal, type TopicId } from "@fluency-lab/shared";

import type { IconName } from "@/components/icon";

export const TOPIC_ICONS: Record<TopicId, IconName> = {
  technology: "phone",
  sports: "trophy",
  music: "note",
  movies_and_series: "film",
  food: "fork",
  travel: "globe",
  gaming: "gamepad",
  job_interviews: "briefcase",
  books: "book",
  health_and_fitness: "heart",
  science: "flask",
  daily_life: "sun",
};

export const GOAL_ICONS: Record<Goal, IconName> = {
  work: "briefcase",
  travel: "globe",
  exams: "clipboard",
  conversation: "chat",
};

export function starterIcon(starter: { topicId: TopicId | null; goal: Goal | null }): IconName {
  if (starter.topicId !== null) return TOPIC_ICONS[starter.topicId];
  return starter.goal === null ? "chat" : GOAL_ICONS[starter.goal];
}

// INFO: a topic id outside the catalog draws the chat icon, as a free chat does.
export function sessionIcon(topicId: string | null): IconName {
  const known = TOPIC_IDS.find((id) => id === topicId);
  return known === undefined ? "chat" : TOPIC_ICONS[known];
}
