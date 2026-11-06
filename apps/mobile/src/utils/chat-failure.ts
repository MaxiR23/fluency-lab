import type { AiFailure } from "@/ai/ai-port";
import type { FailureCause } from "@/auth/auth-port";
import type { DataFailure } from "@/data/data-port";
import { dataFailureMessage, keyReadFailureMessage } from "@/utils/data-message";
import { limitReachedMessage } from "@/utils/spend-limit";

export type ChatFailure =
  | { source: "ai"; failure: AiFailure; cause?: FailureCause }
  | { source: "data"; failure: DataFailure }
  | { source: "limit" };

export type ChatFailureAction = "retry" | "update_key" | null;

export type ChatFailureView = {
  message: string;
  action: ChatFailureAction;
  cause?: FailureCause;
};

export const unsupportedProviderMessage = "OpenAI is coming soon. Use a Claude key for now.";
export const endedSessionMessage = "This conversation has ended.";

const tutorFailed = "The tutor could not answer. Try again.";

const aiMessages: Record<AiFailure, { message: string; action: "retry" | "update_key" }> = {
  invalid_key: {
    message: "Your API key was not accepted. Update it to keep chatting.",
    action: "update_key",
  },
  missing_key: {
    message: "Your API key is missing. Add it to keep chatting.",
    action: "update_key",
  },
  key_unreadable: { message: keyReadFailureMessage, action: "retry" },
  rate_limited: {
    message: "Too many messages for your API key right now. Wait a moment and try again.",
    action: "retry",
  },
  overloaded: { message: "The AI is busy right now. Try again in a moment.", action: "retry" },
  network: {
    message: "Could not reach the AI. Check your connection and try again.",
    action: "retry",
  },
  refused: {
    message: "The tutor could not answer that. Try saying it another way.",
    action: "retry",
  },
  rejected: { message: tutorFailed, action: "retry" },
  unavailable: { message: tutorFailed, action: "retry" },
  bad_response: { message: tutorFailed, action: "retry" },
};

export function chatFailureView(failure: ChatFailure): ChatFailureView {
  if (failure.source === "limit") {
    return {
      message: limitReachedMessage,
      action: null,
      cause: { name: "SpendLimit", detail: null },
    };
  }
  if (failure.source === "data") {
    return { message: dataFailureMessage(failure.failure), action: "retry" };
  }
  const view = aiMessages[failure.failure];
  return failure.cause === undefined ? view : { ...view, cause: failure.cause };
}
