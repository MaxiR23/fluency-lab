import type { TutorRequest } from "@/ai/ai-port";
import { SUMMARY_MAX } from "@/utils/chat-context";
import type { ChatMessage } from "@/utils/chat-conversation";
import { learnerTurn, quotedText } from "@/utils/chat-reply";
import { RULE_NO_KEY } from "@/utils/tutor-prompt";

export const RULE_CONTEXT_SUMMARY = `You summarize an English practice chat between a learner and their tutor, so the tutor can go on with it. The input is JSON: previousSummary is the summary of the chat before these messages, or null, and messages are the next messages, oldest first. Write one summary in English, under ${SUMMARY_MAX} characters, that merges previousSummary with the messages. Keep what the learner shared about themselves, the topics covered, the learner's recurring mistakes, the words already taught, and any question from the tutor still open. Add nothing that was not said.`;

export const CONTEXT_OUTPUT_GUIDE = "Answer in the given JSON format: summary is the summary text.";

// INFO: messages is the whole list, read for the quotes; covered is what the summary takes in.
export function summaryRequest(
  previous: string | null,
  messages: readonly ChatMessage[],
  covered: readonly ChatMessage[],
): TutorRequest {
  return {
    system: [RULE_CONTEXT_SUMMARY, CONTEXT_OUTPUT_GUIDE, RULE_NO_KEY].join("\n"),
    turns: [
      {
        role: "user",
        text: JSON.stringify({
          previousSummary: previous,
          messages: covered.map((m) => ({
            role: m.role === "user" ? "learner" : "tutor",
            text: m.role === "user" ? learnerTurn(m.text, quotedText(messages, m.replyTo)) : m.text,
          })),
        }),
      },
    ],
  };
}
