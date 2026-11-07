import { View } from "react-native";
import Animated, { type FadeInLeft } from "react-native-reanimated";

import { cellVariant, comparisonTableStyle } from "@/components/comparison-table-style";
import { Text } from "@/components/text";

// INFO: the table of a study note. columns is null for a summary, whose points are rows of one
// cell with no header. row gives the entering animation of each row; without it they sit in place.
export function ComparisonTable({
  columns,
  rows,
  row,
}: {
  columns: readonly string[] | null;
  rows: readonly (readonly string[])[];
  row?: (index: number) => FadeInLeft | undefined;
}) {
  const style = comparisonTableStyle();
  return (
    <View style={style.table}>
      {columns === null ? null : (
        <View testID="table-header" style={style.headerRow}>
          {columns.map((label, index) => (
            <View key={`${index}:${label}`} style={style.headerCell}>
              <Text variant="sourceLabel">{label}</Text>
            </View>
          ))}
        </View>
      )}
      {rows.map((cells, index) => (
        <Animated.View
          key={`${index}:${cells.join("|")}`}
          testID={`table-row-${index}`}
          entering={row === undefined ? undefined : row(index)}
          style={style.row(index === rows.length - 1)}
        >
          {cells.map((cell, column) => (
            <View key={column} style={style.cell}>
              <Text variant={cellVariant(column, cells.length)}>{cell}</Text>
            </View>
          ))}
        </Animated.View>
      ))}
    </View>
  );
}
