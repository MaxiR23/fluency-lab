import type { TutorTurn } from "@/ai/ai-port";

export type ProviderMessage = { role: "user" | "assistant"; content: string };

// INFO: the opening line before the first user turn is not sent as history: the
// system prompt carries it, and a leading assistant turn is not documented as
// accepted. Consecutive turns of the same role are merged, so roles alternate.
export function providerMessages(turns: TutorTurn[]): ProviderMessage[] {
  const firstUser = turns.findIndex((turn) => turn.role === "user");
  if (firstUser === -1) return [];
  const messages: ProviderMessage[] = [];
  for (const turn of turns.slice(firstUser)) {
    const role = turn.role === "user" ? "user" : "assistant";
    const last = messages.at(-1);
    if (last !== undefined && last.role === role) {
      last.content = `${last.content}\n\n${turn.text}`;
    } else {
      messages.push({ role, content: turn.text });
    }
  }
  return messages;
}
