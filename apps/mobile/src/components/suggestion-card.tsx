import type { Suggestion } from "@fluency-lab/shared";
import { StyleSheet } from "react-native";

import { IconCard } from "@/components/icon-card";
import { Tag } from "@/components/tag";
import { size } from "@/constants/theme";
import { starterIcon } from "@/utils/topic-icon";

export function SuggestionCard({
  suggestion,
  layout,
  onPress,
}: {
  suggestion: Suggestion;
  layout: "carousel" | "list";
  onPress: () => void;
}) {
  return (
    <IconCard
      icon={starterIcon(suggestion)}
      title={suggestion.title}
      text={suggestion.why}
      topRight={<Tag label={suggestion.tag} />}
      accessibilityLabel={suggestion.title}
      onPress={onPress}
      style={layout === "carousel" ? styles.carousel : styles.list}
    />
  );
}

const styles = StyleSheet.create({
  carousel: { width: size.suggestionCard },
  list: { alignSelf: "stretch" },
});
