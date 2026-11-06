import type { Goal, TopicId } from "@fluency-lab/shared";

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

export function sessionIcon(topicId: TopicId | null): IconName {
  return topicId === null ? "chat" : TOPIC_ICONS[topicId];
}
