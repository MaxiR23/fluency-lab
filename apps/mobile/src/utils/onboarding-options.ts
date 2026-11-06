import { GOALS, goalLabel, type Goal, type Level, type Provider } from "@fluency-lab/shared";

export const levelOptions: readonly { id: Level; label: string; description: string }[] = [
  { id: "beginner", label: "Beginner", description: "I can write short, simple sentences." },
  {
    id: "intermediate",
    label: "Intermediate",
    description: "I can talk about my day, but I make mistakes.",
  },
  {
    id: "advanced",
    label: "Advanced",
    description: "I write with ease and want to sound natural.",
  },
];

export const goalOptions: readonly { id: Goal; label: string }[] = GOALS.map((id) => ({
  id,
  label: goalLabel(id),
}));

export const providerOptions: readonly { id: Provider; label: string }[] = [
  { id: "claude", label: "Claude" },
  { id: "openai", label: "OpenAI" },
];

export const apiKeyNote = "Stored only on this device.";
export const monthlyLimitNote =
  "We'll warn you when you reach it. For a hard cap, also set a spend limit in your provider's console.";
export const DEFAULT_MONTHLY_LIMIT = "10";
export const ONBOARDING_STEPS = 4;
export const stepTitles = ["Level", "Goal", "Topics", "Your AI"] as const;
