import { StyleSheet, View } from "react-native";

import { Screen } from "@/components/screen";
import { Text } from "@/components/text";
import { spacing } from "@/constants/theme";

export default function Progress() {
  return (
    <Screen>
      <View style={styles.content}>
        <Text variant="title">Progress</Text>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { padding: spacing.screenSide, gap: spacing.md },
});
