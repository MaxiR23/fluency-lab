import { topicLabel } from "./topics";

// INFO: the limit set_session_title checks in the database, read by the API schema and the app.
export const SESSION_TITLE_MAX = 60;

export function sessionTitle(topicId: string | null): string {
  return topicId === null ? "Free chat" : topicLabel(topicId);
}
