import type { ViewStyle } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { tabBarLayout } from "@/utils/tab-bar";

// INFO: the padding already includes the bottom inset, so tab screens leave the bottom safe-area edge out.
export function useTabScreenPadding(): ViewStyle {
  return { paddingBottom: tabBarLayout(useSafeAreaInsets().bottom).clearance };
}
