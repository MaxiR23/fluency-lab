import type { Level, StoredCorrection } from "@fluency-lab/shared";

import type { TutorTurn } from "@/ai/ai-port";
import { LEVEL_LINES, LEVEL_UNSET, RULE_NO_KEY, RULE_OTHER_LANGUAGE } from "@/utils/tutor-prompt";

export const RULE_THREAD =
  "You are an English tutor. The learner is asking about the corrections you made to one of their sentences. Answer in English, briefly, at the learner's level, about those corrections only.";
export const RULE_THREAD_DECLINE =
  "If the learner asks about anything else, answer in one friendly sentence and bring them back to the corrections.";
export const RULE_WITHDRAW =
  "If the learner shows that a correction was wrong because their original was correct English, say so and list that correction's number in withdrawn. Never withdraw a correction that was right.";
export const THREAD_OUTPUT_GUIDE =
  "Answer in the given JSON format. reply is your message. newWords lists up to three words or expressions from this exchange worth learning at the learner's level, empty when there are none. withdrawn lists the numbers of the corrections you take back, empty when there are none.";

// INFO: a thread call sends only the learner's sentence, its corrections and the thread:
// no other chat message, no name, goals or topic.
export type ThreadPromptInput = {
  level: Level | null;
  sentence: string;
  corrections: readonly StoredCorrection[];
  explanation: string | null;
};

function correctionLine(item: StoredCorrection, index: number): string {
  const rule = item.rule === undefined ? "" : ` (${item.rule})`;
  const withdrawn = item.withdrawn === true ? " (withdrawn)" : "";
  return `${index + 1}. "${item.original}" → "${item.corrected}"${rule}${withdrawn}`;
}

export function threadPrompt(input: ThreadPromptInput): string {
  const lines = [
    RULE_THREAD,
    RULE_THREAD_DECLINE,
    RULE_OTHER_LANGUAGE,
    RULE_WITHDRAW,
    RULE_NO_KEY,
    input.level === null ? LEVEL_UNSET : LEVEL_LINES[input.level],
    `The learner wrote: "${input.sentence}"`,
    "Your corrections, numbered:",
    ...input.corrections.map(correctionLine),
  ];
  if (input.explanation !== null) lines.push(`Your explanation of them: ${input.explanation}`);
  lines.push(THREAD_OUTPUT_GUIDE);
  return lines.join("\n");
}

export function threadTurns(messages: readonly TutorTurn[], pending: string): TutorTurn[] {
  return [...messages.map(({ role, text }) => ({ role, text })), { role: "user", text: pending }];
}
