import type { Goal, Level } from "./profile-values";
import { TOPIC_IDS, topicLabel, type TopicId } from "./topics";

export type Starter = {
  id: string;
  topicId: TopicId;
  title: string;
  levels: readonly Level[];
  goals: readonly Goal[];
  tags: readonly string[];
};

export type Suggestion = { id: string; topicId: TopicId; title: string; tags: string[] };

export type SuggestionInput = {
  level: Level | null;
  goals: readonly Goal[];
  topics: readonly TopicId[];
};

export const SUGGESTION_LIMIT = 3;

const EASY: readonly Level[] = ["beginner", "intermediate"];
const HARD: readonly Level[] = ["intermediate", "advanced"];

// INFO: per topic, one starter for beginner and intermediate and one for
// intermediate and advanced, so every topic has a starter at every level.
export const STARTERS: readonly Starter[] = [
  {
    id: "technology-1",
    topicId: "technology",
    title: "Describe the phone you use every day",
    levels: EASY,
    goals: ["conversation"],
    tags: ["Everyday"],
  },
  {
    id: "technology-2",
    topicId: "technology",
    title: "Explain how AI could change your job",
    levels: HARD,
    goals: ["work"],
    tags: ["Opinion"],
  },
  {
    id: "sports-1",
    topicId: "sports",
    title: "Talk about a sport you like to watch",
    levels: EASY,
    goals: ["conversation"],
    tags: ["Everyday"],
  },
  {
    id: "sports-2",
    topicId: "sports",
    title: "Debate whether athletes are paid too much",
    levels: HARD,
    goals: ["exams"],
    tags: ["Debate"],
  },
  {
    id: "music-1",
    topicId: "music",
    title: "Tell me about your favorite song",
    levels: EASY,
    goals: ["conversation"],
    tags: ["Everyday"],
  },
  {
    id: "music-2",
    topicId: "music",
    title: "Discuss how streaming changed music",
    levels: HARD,
    goals: ["exams"],
    tags: ["Opinion"],
  },
  {
    id: "movies_and_series-1",
    topicId: "movies_and_series",
    title: "Recommend a series to a friend",
    levels: EASY,
    goals: ["conversation"],
    tags: ["Everyday"],
  },
  {
    id: "movies_and_series-2",
    topicId: "movies_and_series",
    title: "Review a movie you watched recently",
    levels: HARD,
    goals: ["exams", "conversation"],
    tags: ["Review"],
  },
  {
    id: "food-1",
    topicId: "food",
    title: "Describe your favorite meal",
    levels: EASY,
    goals: ["conversation"],
    tags: ["Everyday"],
  },
  {
    id: "food-2",
    topicId: "food",
    title: "Order dinner and handle a mistake in the bill",
    levels: HARD,
    goals: ["travel"],
    tags: ["Role play"],
  },
  {
    id: "travel-1",
    topicId: "travel",
    title: "Ask for directions in a new city",
    levels: EASY,
    goals: ["travel"],
    tags: ["Role play"],
  },
  {
    id: "travel-2",
    topicId: "travel",
    title: "Plan a two week trip and explain your choices",
    levels: HARD,
    goals: ["travel", "conversation"],
    tags: ["Planning"],
  },
  {
    id: "gaming-1",
    topicId: "gaming",
    title: "Explain the rules of a game you enjoy",
    levels: EASY,
    goals: ["conversation"],
    tags: ["Everyday"],
  },
  {
    id: "gaming-2",
    topicId: "gaming",
    title: "Argue if video games are good for learning",
    levels: HARD,
    goals: ["exams"],
    tags: ["Debate"],
  },
  {
    id: "job_interviews-1",
    topicId: "job_interviews",
    title: "Introduce yourself in a job interview",
    levels: EASY,
    goals: ["work"],
    tags: ["Role play"],
  },
  {
    id: "job_interviews-2",
    topicId: "job_interviews",
    title: "Answer: tell me about a time you failed",
    levels: HARD,
    goals: ["work"],
    tags: ["Role play"],
  },
  {
    id: "books-1",
    topicId: "books",
    title: "Talk about a book you read as a kid",
    levels: EASY,
    goals: ["conversation"],
    tags: ["Everyday"],
  },
  {
    id: "books-2",
    topicId: "books",
    title: "Summarize a book and say what it taught you",
    levels: HARD,
    goals: ["exams"],
    tags: ["Review"],
  },
  {
    id: "health_and_fitness-1",
    topicId: "health_and_fitness",
    title: "Describe your daily routine to stay healthy",
    levels: EASY,
    goals: ["conversation"],
    tags: ["Everyday"],
  },
  {
    id: "health_and_fitness-2",
    topicId: "health_and_fitness",
    title: "Discuss how to build a habit that lasts",
    levels: HARD,
    goals: ["conversation", "exams"],
    tags: ["Opinion"],
  },
  {
    id: "science-1",
    topicId: "science",
    title: "Explain why the sky is blue",
    levels: EASY,
    goals: ["exams"],
    tags: ["Explain"],
  },
  {
    id: "science-2",
    topicId: "science",
    title: "Discuss a scientific discovery that impressed you",
    levels: HARD,
    goals: ["exams"],
    tags: ["Opinion"],
  },
  {
    id: "daily_life-1",
    topicId: "daily_life",
    title: "Tell me about your morning",
    levels: EASY,
    goals: ["conversation"],
    tags: ["Everyday"],
  },
  {
    id: "daily_life-2",
    topicId: "daily_life",
    title: "Describe a day that did not go as planned",
    levels: HARD,
    goals: ["conversation", "work"],
    tags: ["Story"],
  },
];

function sharedGoals(entry: Starter, goals: readonly Goal[]): number {
  return entry.goals.filter((goal) => goals.includes(goal)).length;
}

export function suggestTopics(
  input: SuggestionInput,
  catalog: readonly Starter[] = STARTERS,
  limit: number = SUGGESTION_LIMIT,
): Suggestion[] {
  if (limit <= 0) return [];
  const topics: readonly TopicId[] = input.topics.length > 0 ? input.topics : TOPIC_IDS;
  const queues = topics.map((topicId) =>
    catalog
      .filter(
        (entry) =>
          entry.topicId === topicId && (input.level === null || entry.levels.includes(input.level)),
      )
      // INFO: Array.prototype.sort is stable, so ties keep catalog order.
      .sort((a, b) => sharedGoals(b, input.goals) - sharedGoals(a, input.goals)),
  );
  const picked: Suggestion[] = [];
  const rounds = Math.max(0, ...queues.map((queue) => queue.length));
  for (let round = 0; round < rounds; round += 1) {
    for (const queue of queues) {
      const entry = queue[round];
      if (entry === undefined) continue;
      if (picked.length >= limit) return picked;
      picked.push({
        id: entry.id,
        topicId: entry.topicId,
        title: entry.title,
        tags: [topicLabel(entry.topicId), ...entry.tags],
      });
    }
  }
  return picked;
}
