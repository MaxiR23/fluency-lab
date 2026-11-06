import { TOPICS, type TopicId } from "@fluency-lab/shared";
import { StyleSheet, View } from "react-native";

import { Chip } from "@/components/chip";
import { Text } from "@/components/text";
import { spacing } from "@/constants/theme";
import { selectedCountLabel } from "@/utils/onboarding-form";

export function TopicStepFields({
  value,
  onToggle,
}: {
  value: TopicId[];
  onToggle: (topic: TopicId) => void;
}) {
  return (
    <View style={styles.list}>
      <Text variant="caption">{selectedCountLabel(value.length)}</Text>
      <View style={styles.chips}>
        {TOPICS.map((topic) => (
          <Chip
            key={topic.id}
            label={topic.label}
            selected={value.includes(topic.id)}
            onPress={() => onToggle(topic.id)}
          />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  list: { gap: spacing.group },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
});
