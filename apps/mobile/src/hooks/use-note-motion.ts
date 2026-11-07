import { useReducedMotion } from "react-native-reanimated";

import { noteMotion, type NoteMotion } from "@/utils/note-motion";

// INFO: Reanimated reads the setting when the app starts and does not re-render on change.
export function useNoteMotion(): NoteMotion | null {
  return noteMotion(useReducedMotion());
}
