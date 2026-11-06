import type { Goal } from "@fluency-lab/shared";
import { StyleSheet, View } from "react-native";

import { OptionCard } from "@/components/option-card";
import { spacing } from "@/constants/theme";
import { goalOptions } from "@/utils/onboarding-options";

export function GoalStepFields({
  value,
  onToggle,
}: {
  value: Goal[];
  onToggle: (goal: Goal) => void;
}) {
  return (
    <View style={styles.list}>
      {goalOptions.map((option) => (
        <OptionCard
          key={option.id}
          role="checkbox"
          label={option.label}
          selected={value.includes(option.id)}
          onPress={() => onToggle(option.id)}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  list: { gap: spacing.group },
});
