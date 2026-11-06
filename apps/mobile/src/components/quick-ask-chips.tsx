import { Pressable, ScrollView } from "react-native";

import { quickAskChipStyle, quickAskRowStyle } from "@/components/quick-ask-chips-style";
import { Text } from "@/components/text";

export function QuickAskChips({
  asks,
  onAsk,
  disabled,
}: {
  asks: readonly string[];
  onAsk: (text: string) => void;
  disabled: boolean;
}) {
  return (
    <ScrollView
      testID="quick-ask-chips"
      horizontal
      showsHorizontalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
      contentContainerStyle={quickAskRowStyle()}
    >
      {asks.map((ask) => (
        <Pressable
          key={ask}
          accessibilityRole="button"
          accessibilityLabel={ask}
          disabled={disabled}
          onPress={() => onAsk(ask)}
          style={({ pressed }) => quickAskChipStyle({ pressed, disabled }).container}
        >
          {({ pressed }) => (
            <Text style={quickAskChipStyle({ pressed, disabled }).label}>{ask}</Text>
          )}
        </Pressable>
      ))}
    </ScrollView>
  );
}
