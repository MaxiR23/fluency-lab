import { topicLabel, type TopicId } from "./topics";

export function sessionTitle(topicId: TopicId | null): string {
  return topicId === null ? "Free chat" : topicLabel(topicId);
}
