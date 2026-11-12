import { View } from "react-native";

import { tagStyle, type TagVariant } from "@/components/tag-style";
import { Text } from "@/components/text";

export function Tag({ label, variant }: { label: string; variant?: TagVariant }) {
  const style = tagStyle(variant);
  return (
    <View style={style.box}>
      <Text
        variant={style.label}
        numberOfLines={style.lines}
        ellipsizeMode={style.lines === undefined ? undefined : "tail"}
      >
        {label}
      </Text>
    </View>
  );
}
