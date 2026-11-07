import type { ViewStyle } from "react-native";

import { size } from "@/constants/theme";

// INFO: the touch square every icon-only button shares (back, close).
export function iconButtonStyle(): ViewStyle {
  return { width: size.touch, height: size.touch, alignItems: "center", justifyContent: "center" };
}
