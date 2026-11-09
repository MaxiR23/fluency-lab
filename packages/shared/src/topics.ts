export const TOPICS = [
  { id: "technology", label: "Technology" },
  { id: "sports", label: "Sports" },
  { id: "music", label: "Music" },
  { id: "movies_and_series", label: "Movies and series" },
  { id: "food", label: "Food" },
  { id: "travel", label: "Travel" },
  { id: "gaming", label: "Gaming" },
  { id: "job_interviews", label: "Job interviews" },
  { id: "books", label: "Books" },
  { id: "health_and_fitness", label: "Health and fitness" },
  { id: "science", label: "Science" },
  { id: "daily_life", label: "Daily life" },
] as const;

export type TopicId = (typeof TOPICS)[number]["id"];

// INFO: a non-empty tuple, the shape z.enum needs.
export const TOPIC_IDS = TOPICS.map((topic) => topic.id) as unknown as readonly [
  TopicId,
  ...TopicId[],
];

export function topicLabel(id: string): string {
  const topic = TOPICS.find((entry) => entry.id === id);
  return topic === undefined ? id : topic.label;
}
