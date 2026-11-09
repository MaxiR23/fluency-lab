import { topicLabel } from "./topics";

export function sessionTitle(topicId: string | null): string {
  return topicId === null ? "Free chat" : topicLabel(topicId);
}
