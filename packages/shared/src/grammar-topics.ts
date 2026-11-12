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

export type TopicPoint = { label: string; brief: string };

// INFO: the points a grammar topic is practiced through, rotated by the code over the slots of a
// run. label is what the exercise and the result show (32 characters at most); brief tells the
// writer what the point is.
export const TOPIC_POINTS: Record<GrammarTopicId, readonly TopicPoint[]> = {
  going_to_vs_will: [
    {
      label: "Will: instant decisions",
      brief:
        "a decision made at the moment of speaking, as a reaction to something just said or seen.",
    },
    { label: "Going to: plans", brief: "a plan decided before the moment of speaking." },
    { label: "Going to: evidence now", brief: "a prediction from something visible now." },
    {
      label: "Will: predictions",
      brief: 'a prediction from opinion, with "I think", "probably" or "I\'m sure".',
    },
    { label: "Will: offers and promises", brief: "an offer, a promise or a refusal." },
  ],
  present_simple_future: [
    {
      label: "Timetables: transport",
      brief:
        "a train, bus, flight or ferry that leaves, departs or arrives at a fixed time; the subject is the transport.",
    },
    {
      label: "Timetables: events",
      brief:
        "a film, class, match, concert or shop that starts, begins, finishes, opens or closes at a fixed time; the subject is the event or the place.",
    },
    {
      label: "After when, until, as soon as",
      brief:
        'the present simple in a time clause about the future ("I\'ll call you when I arrive").',
    },
  ],
  past_simple_vs_present_perfect: [
    {
      label: "Finished time: past simple",
      brief: "a finished time marker (yesterday, last week, in 2019, two days ago).",
    },
    {
      label: "Unfinished time: perfect",
      brief: "a period not finished yet (today, this week, this year, so far).",
    },
    { label: "Experience: ever, never", brief: "life experience with no time given." },
    {
      label: "For and since up to now",
      brief: "a state that began in the past and still goes on.",
    },
    {
      label: "Details in the past simple",
      brief: "a question or a detail about a known past event (when, where, who).",
    },
  ],
  present_perfect: [
    { label: "Already, just, yet", brief: "the three adverbs and their place in the sentence." },
    { label: "Ever and never", brief: "life experience." },
    { label: "For and since", brief: "duration up to now." },
    {
      label: "Been or gone",
      brief:
        '"has been" against "has gone" for a visit or a trip; the word "to" stays in the sentence, outside the gap and outside the options.',
    },
    {
      label: "Irregular past participles",
      brief: "written, eaten, taken, seen, bought and the like.",
    },
    { label: "Negatives and questions", brief: "haven't, hasn't and \"Have you…?\"." },
  ],
  conditionals: [
    { label: "Zero conditional", brief: "general truths." },
    { label: "First conditional", brief: "a real future possibility." },
    { label: "Second conditional", brief: "an unreal present or future situation." },
    { label: "Third conditional", brief: "an unreal past situation." },
    { label: "Unless", brief: '"unless" in place of "if … not".' },
  ],
  prepositions_of_time: [
    { label: "At: clock times", brief: "at with clock times, night and the weekend." },
    { label: "On: days and dates", brief: "on with days and dates." },
    {
      label: "In: months, years, parts of day",
      brief: "in with months, years, seasons and parts of the day.",
    },
    { label: "No preposition", brief: "none before last, next, this and every." },
    { label: "For or during", brief: "for with a length of time, during with a noun." },
    { label: "By or until", brief: "by for a deadline, until for a state that continues." },
  ],
  articles: [
    {
      label: "A or an: first mention",
      brief: "a or an for something mentioned for the first time, and with jobs.",
    },
    {
      label: "The: known or unique",
      brief: "the for something already mentioned or the only one.",
    },
    {
      label: "No article: things in general",
      brief: "no article with plurals and uncountables in general statements.",
    },
    {
      label: "No article: fixed places",
      brief: "no article in go to school, at home, have lunch, by bus.",
    },
    { label: "The with superlatives", brief: "the with superlatives and ordinals." },
  ],
  phrasal_verbs: [
    { label: "Daily routines", brief: "get up, wake up, put on, take off, turn on, turn off." },
    {
      label: "Pronoun in the middle",
      brief: 'a separable phrasal verb with a pronoun object ("turn it off").',
    },
    {
      label: "Three-word phrasal verbs",
      brief: "look forward to, run out of, get on with, put up with.",
    },
    { label: "Travel", brief: "set off, check in, take off, get on, get off, pick up." },
    { label: "Work and study", brief: "hand in, look up, find out, put off, catch up." },
  ],
};

// INFO: the points of a topic id; [] for no id or an id outside the catalog.
export function topicPoints(id: string | null): readonly TopicPoint[] {
  const topic = GRAMMAR_TOPICS.find((entry) => entry.id === id);
  return topic === undefined ? [] : TOPIC_POINTS[topic.id];
}

// INFO: the topics that contrast two grammatical forms by usage. Both forms of a gap or a fix
// are often grammatical there, so the practice plans only choose and fix exercises for them.
export const CONTRAST_TOPIC_IDS: readonly GrammarTopicId[] = [
  "going_to_vs_will",
  "past_simple_vs_present_perfect",
  "present_simple_future",
];

// INFO: a non-empty tuple, the shape z.enum needs.
export const GRAMMAR_TOPIC_IDS = GRAMMAR_TOPICS.map((topic) => topic.id) as unknown as readonly [
  GrammarTopicId,
  ...GrammarTopicId[],
];

export function grammarTopicLabel(id: string): string {
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
