import { createClaudeAi } from "@/ai/claude-ai";
import type { AiPort } from "@/ai/ai-port";
import { keys } from "@/keys";

// INFO: the only place that reads the key. Screens and hooks never call readApiKey.
// fetch is looked up on each call, not captured at import.
export const ai: AiPort = createClaudeAi({
  fetchFn: (input, init) => fetch(input, init),
  readKey: () => keys.readApiKey(),
});
