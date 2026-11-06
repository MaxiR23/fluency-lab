import { GOALS, goalLabel, type Goal, type Level } from "./profile-values";
import { TOPIC_IDS, topicLabel, type TopicId } from "./topics";

type StarterBase = { id: string; levels: readonly Level[]; title: string; opener: string };

export type Starter = StarterBase &
  ({ topicId: TopicId; goal: null } | { topicId: null; goal: Goal });

export type SuggestionTag = "Your interests" | "For your goal" | "New topic";

export type Suggestion = {
  id: string;
  title: string;
  opener: string;
  topicId: TopicId | null;
  goal: Goal | null;
  tag: SuggestionTag;
  why: string;
};

export type SuggestionInput = {
  level: Level | null;
  goals: readonly Goal[];
  topics: readonly TopicId[];
};

export const SUGGESTION_LIMIT = 6;

const ALL: readonly Level[] = ["beginner", "intermediate", "advanced"];
const EASY: readonly Level[] = ["beginner", "intermediate"];
const HARD: readonly Level[] = ["intermediate", "advanced"];
const FIRST: readonly Level[] = ["beginner"];

// INFO: the content comes from the approved starter catalog, in its order.
export const STARTERS: readonly Starter[] = [
  {
    id: "tech-app",
    topicId: "technology",
    goal: null,
    levels: ALL,
    title: "The app you use most",
    opener: "Which app do you open most every day, and what do you use it for?",
  },
  {
    id: "tech-ai",
    topicId: "technology",
    goal: null,
    levels: HARD,
    title: "AI in your daily life",
    opener: "Do you use AI tools in your life or work? What do you think they are good and bad at?",
  },
  {
    id: "tech-gadget",
    topicId: "technology",
    goal: null,
    levels: EASY,
    title: "A gadget you'd like to buy",
    opener: "If you could buy any gadget tomorrow, what would it be and why?",
  },
  {
    id: "sports-match",
    topicId: "sports",
    goal: null,
    levels: ALL,
    title: "A match you'll never forget",
    opener: "Tell me about a game or match you watched that you still remember. What happened?",
  },
  {
    id: "sports-play",
    topicId: "sports",
    goal: null,
    levels: EASY,
    title: "Sports you play",
    opener: "Do you play any sport? How often, and who do you play with?",
  },
  {
    id: "sports-fan",
    topicId: "sports",
    goal: null,
    levels: HARD,
    title: "Being a fan",
    opener: "What team do you support? How did you start following them?",
  },
  {
    id: "music-song",
    topicId: "music",
    goal: null,
    levels: EASY,
    title: "A song on repeat",
    opener: "What song are you listening to a lot these days? What do you like about it?",
  },
  {
    id: "music-concert",
    topicId: "music",
    goal: null,
    levels: HARD,
    title: "Your best concert",
    opener: "What is the best concert you have been to? Describe the night.",
  },
  {
    id: "music-taste",
    topicId: "music",
    goal: null,
    levels: ALL,
    title: "How your taste changed",
    opener: "Has your taste in music changed over the years? What did you listen to as a teenager?",
  },
  {
    id: "movies-recommend",
    topicId: "movies_and_series",
    goal: null,
    levels: ALL,
    title: "Recommend a series",
    opener:
      "What series would you recommend to a friend right now? Try to convince me to watch it.",
  },
  {
    id: "movies-ending",
    topicId: "movies_and_series",
    goal: null,
    levels: HARD,
    title: "An ending you'd change",
    opener: "Is there a movie or series ending you didn't like? How would you change it?",
  },
  {
    id: "movies-weekend",
    topicId: "movies_and_series",
    goal: null,
    levels: FIRST,
    title: "Movie night",
    opener: "What kind of movies do you like to watch on the weekend?",
  },
  {
    id: "food-cook",
    topicId: "food",
    goal: null,
    levels: EASY,
    title: "A dish you cook well",
    opener: "What is a dish you can cook well? Tell me how you make it.",
  },
  {
    id: "food-restaurant",
    topicId: "food",
    goal: null,
    levels: ALL,
    title: "Ordering at a restaurant",
    opener:
      "Let's role-play: I'm the waiter and you just sat down. Good evening! What can I get you to drink?",
  },
  {
    id: "food-local",
    topicId: "food",
    goal: null,
    levels: HARD,
    title: "Food from your country",
    opener:
      "What food from your country should every visitor try? Explain it to someone who has never had it.",
  },
  {
    id: "travel-trip",
    topicId: "travel",
    goal: null,
    levels: ALL,
    title: "Your best trip",
    opener: "What is the best trip you have ever taken? Where did you go and what did you do?",
  },
  {
    id: "travel-plan",
    topicId: "travel",
    goal: null,
    levels: EASY,
    title: "Planning your next trip",
    opener: "Where would you like to travel next? What would you do there?",
  },
  {
    id: "travel-problem",
    topicId: "travel",
    goal: null,
    levels: HARD,
    title: "When a trip went wrong",
    opener:
      "Has something ever gone wrong on a trip? A lost bag, a missed flight? Tell me the story.",
  },
  {
    id: "gaming-favorite",
    topicId: "gaming",
    goal: null,
    levels: ALL,
    title: "Your favorite game",
    opener: "What game have you enjoyed the most? What makes it special?",
  },
  {
    id: "gaming-explain",
    topicId: "gaming",
    goal: null,
    levels: HARD,
    title: "Explain a game's rules",
    opener: "Pick a game you know well and explain how to play it, as if I had never played it.",
  },
  {
    id: "gaming-online",
    topicId: "gaming",
    goal: null,
    levels: EASY,
    title: "Playing online",
    opener: "Do you play online with other people? What is it like?",
  },
  {
    id: "jobs-intro",
    topicId: "job_interviews",
    goal: null,
    levels: ALL,
    title: "Tell me about yourself",
    opener:
      "Let's practice an interview. I'm the interviewer: so, tell me a little about yourself.",
  },
  {
    id: "jobs-strength",
    topicId: "job_interviews",
    goal: null,
    levels: HARD,
    title: "Strengths and weaknesses",
    opener:
      "Interview practice: what would you say is your biggest strength, and one thing you are working to improve?",
  },
  {
    id: "jobs-project",
    topicId: "job_interviews",
    goal: null,
    levels: HARD,
    title: "A project you're proud of",
    opener: "Interview practice: tell me about a project you are proud of and what your role was.",
  },
  {
    id: "books-reading",
    topicId: "books",
    goal: null,
    levels: ALL,
    title: "What you're reading",
    opener: "Are you reading anything right now? What is it about?",
  },
  {
    id: "books-change",
    topicId: "books",
    goal: null,
    levels: HARD,
    title: "A book that changed you",
    opener: "Is there a book that changed the way you think about something? How?",
  },
  {
    id: "books-recommend",
    topicId: "books",
    goal: null,
    levels: EASY,
    title: "Recommend a book",
    opener: "What book would you recommend to someone who doesn't read much?",
  },
  {
    id: "health-routine",
    topicId: "health_and_fitness",
    goal: null,
    levels: ALL,
    title: "Your daily routine",
    opener: "What does a healthy day look like for you? Walk me through it.",
  },
  {
    id: "health-goal",
    topicId: "health_and_fitness",
    goal: null,
    levels: HARD,
    title: "A fitness goal",
    opener: "Do you have a fitness or health goal right now? What are you doing to reach it?",
  },
  {
    id: "health-sleep",
    topicId: "health_and_fitness",
    goal: null,
    levels: EASY,
    title: "Sleep habits",
    opener: "How many hours do you usually sleep? Do you think it's enough?",
  },
  {
    id: "science-discovery",
    topicId: "science",
    goal: null,
    levels: HARD,
    title: "A discovery that amazes you",
    opener: "What scientific discovery or fact amazes you the most? Explain it in simple words.",
  },
  {
    id: "science-space",
    topicId: "science",
    goal: null,
    levels: ALL,
    title: "Would you go to space?",
    opener: "If you had the chance to travel to space, would you go? Why or why not?",
  },
  {
    id: "science-future",
    topicId: "science",
    goal: null,
    levels: HARD,
    title: "The world in 50 years",
    opener: "How do you imagine daily life 50 years from now?",
  },
  {
    id: "daily-weekend",
    topicId: "daily_life",
    goal: null,
    levels: ALL,
    title: "Your weekend",
    opener: "What did you do last weekend? Tell me about it.",
  },
  {
    id: "daily-home",
    topicId: "daily_life",
    goal: null,
    levels: EASY,
    title: "Where you live",
    opener: "Describe your neighborhood. What do you like about living there?",
  },
  {
    id: "daily-habit",
    topicId: "daily_life",
    goal: null,
    levels: HARD,
    title: "A habit you want to change",
    opener: "Is there a habit you would like to change? What have you tried so far?",
  },
  {
    id: "goal-work-meeting",
    topicId: null,
    goal: "work",
    levels: HARD,
    title: "Running a short meeting",
    opener: "Role-play: you are starting a team meeting. Open it and explain today's goal.",
  },
  {
    id: "goal-work-email",
    topicId: null,
    goal: "work",
    levels: ALL,
    title: "Writing to a colleague",
    opener: "Write a short message to a colleague asking for help with a task. I'll reply as them.",
  },
  {
    id: "goal-work-job",
    topicId: null,
    goal: "work",
    levels: EASY,
    title: "Explaining your job",
    opener: "What do you do for work? Explain it to someone outside your field.",
  },
  {
    id: "goal-travel-hotel",
    topicId: null,
    goal: "travel",
    levels: EASY,
    title: "Checking in at a hotel",
    opener:
      "Role-play: I'm at the hotel front desk. Good afternoon, welcome! Do you have a reservation?",
  },
  {
    id: "goal-travel-directions",
    topicId: null,
    goal: "travel",
    levels: EASY,
    title: "Asking for directions",
    opener: "Role-play: you're lost in a new city and you stop me on the street. What do you ask?",
  },
  {
    id: "goal-travel-airport",
    topicId: null,
    goal: "travel",
    levels: HARD,
    title: "A problem at the airport",
    opener:
      "Role-play: your flight was just cancelled and I'm the airline agent. Explain your situation.",
  },
  {
    id: "goal-exams-opinion",
    topicId: null,
    goal: "exams",
    levels: HARD,
    title: "Give and defend an opinion",
    opener:
      "Exam practice: do you think people should work from home? Give your opinion with two reasons.",
  },
  {
    id: "goal-exams-describe",
    topicId: null,
    goal: "exams",
    levels: EASY,
    title: "Describe a place",
    opener: "Exam practice: describe a place you like to visit, in at least five sentences.",
  },
  {
    id: "goal-exams-compare",
    topicId: null,
    goal: "exams",
    levels: HARD,
    title: "Compare two options",
    opener: "Exam practice: compare living in a big city and in a small town. Which do you prefer?",
  },
  {
    id: "goal-conv-day",
    topicId: null,
    goal: "conversation",
    levels: ALL,
    title: "How was your day?",
    opener: "Hey! How was your day? Tell me one good thing that happened.",
  },
  {
    id: "goal-conv-plans",
    topicId: null,
    goal: "conversation",
    levels: EASY,
    title: "Plans for the week",
    opener: "What plans do you have for this week?",
  },
  {
    id: "goal-conv-story",
    topicId: null,
    goal: "conversation",
    levels: HARD,
    title: "A funny story",
    opener: "Tell me a funny or strange thing that happened to you recently.",
  },
];

const NEW_WHY = "Something different to try";

function roundRobin(lists: readonly (readonly Starter[])[]): Starter[] {
  const merged: Starter[] = [];
  const rounds = Math.max(0, ...lists.map((list) => list.length));
  for (let round = 0; round < rounds; round += 1) {
    for (const list of lists) {
      const entry = list[round];
      if (entry !== undefined) merged.push(entry);
    }
  }
  return merged;
}

function describeStarter(entry: Starter, input: SuggestionInput): Suggestion {
  const base = {
    id: entry.id,
    title: entry.title,
    opener: entry.opener,
    topicId: entry.topicId,
    goal: entry.goal,
  };
  if (entry.topicId !== null && input.topics.includes(entry.topicId)) {
    return { ...base, tag: "Your interests", why: `Because you like ${topicLabel(entry.topicId)}` };
  }
  if (entry.goal !== null && input.goals.includes(entry.goal)) {
    return {
      ...base,
      tag: "For your goal",
      why: `Useful for ${goalLabel(entry.goal).toLowerCase()}`,
    };
  }
  return { ...base, tag: "New topic", why: NEW_WHY };
}

export function suggestTopics(
  input: SuggestionInput,
  catalog: readonly Starter[] = STARTERS,
  limit: number = SUGGESTION_LIMIT,
): Suggestion[] {
  if (limit <= 0) return [];
  const fits = catalog.filter(
    (entry) => input.level === null || entry.levels.includes(input.level),
  );
  const ofTopic = (topicId: TopicId) => fits.filter((entry) => entry.topicId === topicId);
  const ofGoal = (goal: Goal) => fits.filter((entry) => entry.goal === goal);
  const queues: Starter[][] = [
    roundRobin(input.topics.map(ofTopic)),
    roundRobin(input.goals.map(ofGoal)),
    [
      ...roundRobin(TOPIC_IDS.filter((id) => !input.topics.includes(id)).map(ofTopic)),
      ...roundRobin(GOALS.filter((goal) => !input.goals.includes(goal)).map(ofGoal)),
    ],
  ];
  const picked: Suggestion[] = [];
  const seen = new Set<string>();
  const positions = queues.map(() => 0);
  while (picked.length < limit) {
    let took = false;
    for (const [index, queue] of queues.entries()) {
      if (picked.length >= limit) break;
      let entry = queue[positions[index]];
      while (entry !== undefined && seen.has(entry.id)) {
        positions[index] += 1;
        entry = queue[positions[index]];
      }
      if (entry === undefined) continue;
      positions[index] += 1;
      seen.add(entry.id);
      picked.push(describeStarter(entry, input));
      took = true;
    }
    if (!took) break;
  }
  return picked;
}

export function starterById(id: string): Starter | undefined {
  return STARTERS.find((entry) => entry.id === id);
}

// INFO: a non-empty tuple, the shape z.enum needs.
export const STARTER_IDS = STARTERS.map((entry) => entry.id) as unknown as readonly [
  string,
  ...string[],
];

export function allSuggestions(
  input: SuggestionInput,
  catalog: readonly Starter[] = STARTERS,
): Suggestion[] {
  return suggestTopics(input, catalog, Infinity);
}
