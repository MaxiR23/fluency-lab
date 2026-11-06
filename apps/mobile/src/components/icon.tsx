import { type ColorValue, View } from "react-native";
import Svg, { Path } from "react-native-svg";

import { size as sizeToken, strokeWidth as strokeWidthToken } from "@/constants/theme";

export type IconName =
  | "home"
  | "progress"
  | "settings"
  | "chat"
  | "check"
  | "arrow"
  | "person"
  | "globe"
  | "briefcase"
  | "phone"
  | "trophy"
  | "note"
  | "film"
  | "fork"
  | "gamepad"
  | "book"
  | "heart"
  | "flask"
  | "sun"
  | "clipboard"
  | "back"
  | "lock"
  | "send"
  | "close"
  | "trash";

// INFO: shapes the source draws as a circle or a rect are written as path data,
// so Icon only draws Path.
const paths: Record<IconName, readonly string[]> = {
  home: ["M3 11l9-7 9 7v9a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z"],
  progress: ["M4 20V10M10 20V4M16 20v-7M22 20H2"],
  settings: [
    "M9 12a3 3 0 1 0 6 0a3 3 0 1 0-6 0",
    "M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z",
  ],
  chat: ["M21 12a8 8 0 0 1-11.6 7.1L4 20.5l1.4-5A8 8 0 1 1 21 12z"],
  check: ["M20 6 9 17l-5-5"],
  arrow: ["M5 12h14M13 6l6 6-6 6"],
  person: ["M8 8a4 4 0 1 0 8 0a4 4 0 1 0-8 0", "M4 21a8 8 0 0 1 16 0"],
  globe: [
    "M2 12h20",
    "M12 2a15 15 0 0 1 0 20",
    "M12 2a15 15 0 0 0 0 20",
    "M2 12a10 10 0 1 0 20 0a10 10 0 1 0-20 0",
  ],
  briefcase: [
    "M5 7h14a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2z",
    "M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2",
  ],
  phone: ["M8 2h8a2 2 0 0 1 2 2v16a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2z", "M11 18h2"],
  trophy: [
    "M8 4h8v5a4 4 0 0 1-8 0z",
    "M8 6H5a3 3 0 0 0 3 4",
    "M16 6h3a3 3 0 0 1-3 4",
    "M12 13v4",
    "M9 21h6",
    "M10 17h4",
  ],
  note: [
    "M9 18V5l11-2v13",
    "M3 18a3 3 0 1 0 6 0a3 3 0 1 0-6 0",
    "M14 16a3 3 0 1 0 6 0a3 3 0 1 0-6 0",
  ],
  film: [
    "M4 5h16a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1z",
    "M10 9l5 3-5 3z",
  ],
  fork: ["M7 3v18", "M4 3v5a3 3 0 0 0 6 0V3", "M17 21V3a4 4 0 0 0-3 4v6h3"],
  gamepad: [
    "M6 8h12a4 4 0 0 1 4 4v1a4 4 0 0 1-7.2 2.4L14 15h-4l-.8.4A4 4 0 0 1 2 13v-1a4 4 0 0 1 4-4z",
    "M7 11v3",
    "M5.5 12.5h3",
    "M16 12h.01",
    "M18 14h.01",
  ],
  book: ["M2 5h6a4 4 0 0 1 4 4v11a3 3 0 0 0-3-3H2z", "M22 5h-6a4 4 0 0 0-4 4v11a3 3 0 0 1 3-3h7z"],
  heart: [
    "M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1-1.1a5.5 5.5 0 0 0-7.8 7.8L12 21l8.8-8.6a5.5 5.5 0 0 0 0-7.8z",
  ],
  flask: [
    "M9 3h6",
    "M10 3v6L4.5 19a1.5 1.5 0 0 0 1.3 2h12.4a1.5 1.5 0 0 0 1.3-2L14 9V3",
    "M7 15h10",
  ],
  sun: [
    "M8 12a4 4 0 1 0 8 0a4 4 0 1 0-8 0",
    "M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4",
  ],
  clipboard: [
    "M9 3h6a1 1 0 0 1 1 1v1H8V4a1 1 0 0 1 1-1z",
    "M8 4H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2h-2",
    "M9 14l2 2 4-4",
  ],
  back: ["M15 18l-6-6 6-6"],
  lock: [
    "M7 11h10a2 2 0 0 1 2 2v6a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2v-6a2 2 0 0 1 2-2z",
    "M8 11V7a4 4 0 0 1 8 0v4",
  ],
  send: ["M22 2 11 13", "M22 2 15 22l-4-9-9-4z"],
  close: ["M18 6 6 18", "M6 6l12 12"],
  trash: [
    "M3 6h18",
    "M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2",
    "M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6",
  ],
};

export function Icon({
  name,
  color,
  size = sizeToken.icon,
  strokeWidth = strokeWidthToken.icon,
}: {
  name: IconName;
  color: ColorValue;
  size?: number;
  strokeWidth?: number;
}) {
  return (
    <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" testID={`icon-${name}`}>
        {paths[name].map((d) => (
          <Path
            key={d}
            d={d}
            stroke={color}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        ))}
      </Svg>
    </View>
  );
}
