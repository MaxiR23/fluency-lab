import { StyleSheet, View } from "react-native";

import { Icon } from "@/components/icon";
import { ListRow } from "@/components/list-row";
import { selectableStyle } from "@/components/selectable-style";
import { Text } from "@/components/text";
import { colors, radius, size, strokeWidth } from "@/constants/theme";
import type { ResultRow } from "@/utils/practice-result";

// INFO: the card of rows of practice-result.html: a check for a rule answered all right and an X
// for one with a miss, with its count.
export function ResultList({ rows }: { rows: readonly ResultRow[] }) {
  return (
    <View style={[selectableStyle({ selected: false }), styles.card]}>
      {rows.map((row, index) => (
        <ListRow
          key={row.label}
          title={row.label}
          dense
          last={index === rows.length - 1}
          leading={
            <View style={[styles.badge, row.allRight ? styles.right : styles.miss]}>
              <Icon
                name={row.allRight ? "check" : "close"}
                color={row.allRight ? colors.accent : colors.miss}
                size={size.iconTiny}
                strokeWidth={strokeWidth.badge}
              />
            </View>
          }
          trailing={<Text variant="caption">{`${row.right}/${row.total}`}</Text>}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { alignSelf: "stretch", overflow: "hidden" },
  badge: {
    width: size.rowBadge,
    height: size.rowBadge,
    borderRadius: radius.pill,
    alignItems: "center",
    justifyContent: "center",
  },
  right: { backgroundColor: colors.accentLine },
  miss: { backgroundColor: colors.missSurface },
});
