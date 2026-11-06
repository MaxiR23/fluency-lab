export type Correction = { original: string; corrected: string };

export type ChatItem =
  | { kind: "tutor"; id: string; text: string }
  | {
      kind: "user";
      id: string;
      text: string;
      corrections: Correction[];
      explanation: string | null;
    }
  | { kind: "new_word"; id: string; word: string };

export function correctionsLabel(count: number): string | null {
  if (count <= 0) return null;
  return count === 1 ? "1 correction" : `${count} corrections`;
}
