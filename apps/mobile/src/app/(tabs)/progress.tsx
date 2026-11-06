import { StyleSheet, View } from "react-native";

import { Screen } from "@/components/screen";
import { Text } from "@/components/text";
import { spacing } from "@/constants/theme";
import { useTabScreenPadding } from "@/hooks/use-tab-screen-padding";

export default function Progress() {
  const padding = useTabScreenPadding();
  return (
    <Screen edges={["top", "left", "right"]}>
      <View testID="progress-content" style={[styles.content, padding]}>
        <Text variant="title">Progress</Text>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { padding: spacing.screenSide, gap: spacing.md },
});
