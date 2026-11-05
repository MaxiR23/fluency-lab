export const colors = {
  background: "#000000",
  surface: "#141414",
  border: "#262626",
  text: "#F5F5F5",
  textMuted: "#A3A3A3",
  textPlaceholder: "#737373",
  accent: "#6DA5C0",
  accentDeep: "#072E33",
  accentLine: "#0C4A50",
  accentPressed: "#0C7075",
  error: "#F87171",
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  linkVertical: 6,
  logoGap: 10,
  group: 12,
  screenSide: 20,
  screenBottom: 40,
  screenTop: 72,
} as const;
export const radius = { control: 18, badge: 12 } as const;
export const size = { control: 52, badge: 40, icon: 22 } as const;
export const strokeWidth = { icon: 1.8 } as const;
export const borderWidth = { thin: 1 } as const;
export const fontSize = { caption: 13, small: 14, body: 15, brand: 17, title: 28 } as const;
// INFO: React Native takes these in pixels; the design gives them as ratios and em.
export const lineHeight = { body: 22.5, title: 33.6 } as const;
export const letterSpacing = { brand: -0.17, title: -0.56 } as const;
export const fontFamily = {
  regular: "PlusJakartaSans_400Regular",
  semibold: "PlusJakartaSans_600SemiBold",
  bold: "PlusJakartaSans_700Bold",
} as const;
