export const colors = {
  background: "#000000",
  surface: "#141414",
  border: "#262626",
  text: "#F5F5F5",
  textMuted: "#A3A3A3",
  accent: "#6DA5C0",
  accentDeep: "#072E33",
  accentLine: "#0C4A50",
  accentPressed: "#0C7075",
  error: "#F87171",
} as const;

export const spacing = { xs: 4, sm: 8, md: 16, lg: 24, xl: 32 } as const;
export const radius = { control: 18 } as const;
export const borderWidth = { thin: 1 } as const;
export const fontSize = { small: 14, body: 16, title: 28 } as const;
export const fontFamily = {
  regular: "PlusJakartaSans_400Regular",
  semibold: "PlusJakartaSans_600SemiBold",
} as const;
