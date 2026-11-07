import { useReducedMotion } from "react-native-reanimated";

import {
  exerciseMotion,
  focusMotion,
  homeMotion,
  resultMotion,
  type ExerciseMotion,
  type FocusMotion,
  type HomeMotion,
  type ResultMotion,
} from "@/utils/practice-motion";

export type PracticeMotion = {
  home: HomeMotion | null;
  focus: FocusMotion | null;
  exercise: ExerciseMotion | null;
  result: ResultMotion | null;
};

// INFO: Reanimated reads the setting when the app starts and does not re-render on change.
export function usePracticeMotion(): PracticeMotion {
  const reduce = useReducedMotion();
  return {
    home: homeMotion(reduce),
    focus: focusMotion(reduce),
    exercise: exerciseMotion(reduce),
    result: resultMotion(reduce),
  };
}
