import type { Level } from "./profile-values";

export const GRAMMAR_TOPICS = [
  { id: "going_to_vs_will", label: "Going to vs will", levels: ["beginner", "intermediate"] },
  { id: "present_simple_future", label: "Present simple for the future", levels: ["intermediate"] },
  {
    id: "past_simple_vs_present_perfect",
    label: "Past simple vs present perfect",
    levels: ["intermediate", "advanced"],
  },
  { id: "present_perfect", label: "Present perfect", levels: ["beginner"] },
  { id: "conditionals", label: "Conditionals", levels: ["intermediate", "advanced"] },
  {
    id: "prepositions_of_time",
    label: "Prepositions of time",
    levels: ["beginner", "intermediate"],
  },
  { id: "articles", label: "Articles", levels: ["beginner", "advanced"] },
  { id: "phrasal_verbs", label: "Phrasal verbs", levels: ["intermediate", "advanced"] },
] as const satisfies readonly { id: string; label: string; levels: readonly Level[] }[];

export type GrammarTopicId = (typeof GRAMMAR_TOPICS)[number]["id"];

export type GrammarTopic = { id: GrammarTopicId; label: string };

// INFO: a non-empty tuple, the shape z.enum needs.
export const GRAMMAR_TOPIC_IDS = GRAMMAR_TOPICS.map((topic) => topic.id) as unknown as readonly [
  GrammarTopicId,
  ...GrammarTopicId[],
];

export function grammarTopicLabel(id: GrammarTopicId): string {
  const topic = GRAMMAR_TOPICS.find((entry) => entry.id === id);
  return topic === undefined ? id : topic.label;
}

// INFO: [] when the level is not set: no level, no suggestion.
export function suggestedGrammarTopics(level: Level | null): GrammarTopic[] {
  if (level === null) return [];
  return GRAMMAR_TOPICS.filter((topic) => (topic.levels as readonly Level[]).includes(level)).map(
    ({ id, label }) => ({ id, label }),
  );
}

export function orderedGrammarTopics(level: Level | null): GrammarTopic[] {
  const suggested = suggestedGrammarTopics(level);
  const rest = GRAMMAR_TOPICS.filter(
    (topic) => !suggested.some((entry) => entry.id === topic.id),
  ).map(({ id, label }) => ({ id, label }));
  return [...suggested, ...rest];
}
