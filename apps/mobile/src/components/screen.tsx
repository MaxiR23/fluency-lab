import type { ReactNode } from "react";
import { StyleSheet } from "react-native";
import { type Edges, SafeAreaView } from "react-native-safe-area-context";

import { colors } from "@/constants/theme";

export function Screen({
  children,
  testID,
  edges,
}: {
  children?: ReactNode;
  testID?: string;
  edges?: Edges;
}) {
  return (
    <SafeAreaView style={styles.screen} testID={testID} edges={edges}>
      {children}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
});
