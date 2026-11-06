import type { DataFailure } from "@/data/data-port";

const genericMessage = "Something went wrong. Wait a moment and try again.";

const messages: Record<DataFailure, string> = {
  network: "Could not reach the server. Check your connection and try again.",
  unauthorized: "Your session ended. Sign in again.",
  not_found: genericMessage,
  invalid_input: genericMessage,
  unavailable: genericMessage,
  bad_response: genericMessage,
};

export function dataFailureMessage(failure: DataFailure): string {
  return messages[failure];
}

export const keySaveFailureMessage = "Could not save your key on this device. Try again.";
export const keyDeleteFailureMessage =
  "Could not remove the saved key from this device. Try again.";
export const keyReadFailureMessage = "Could not read your key on this device. Try again.";
