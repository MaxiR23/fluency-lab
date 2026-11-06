import type { Level } from "@fluency-lab/shared";
import { StyleSheet, View } from "react-native";

import { OptionCard } from "@/components/option-card";
import { spacing } from "@/constants/theme";
import { levelOptions } from "@/utils/onboarding-options";

export function LevelStepFields({
  value,
  onChange,
}: {
  value: Level | null;
  onChange: (level: Level) => void;
}) {
  return (
    <View style={styles.list}>
      {levelOptions.map((option) => (
        <OptionCard
          key={option.id}
          role="radio"
          label={option.label}
          description={option.description}
          selected={value === option.id}
          onPress={() => onChange(option.id)}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  list: { gap: spacing.group },
});
