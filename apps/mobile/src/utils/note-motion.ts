import { motion } from "@/constants/theme";

export type NoteMotion = { duration: number; delay: number; stagger: number; offset: number };
export type RowMotion = { duration: number; delay: number; offset: number };

// INFO: built once at module level. note.html: the rows slide in from the left, one after the other.
const NOTE: NoteMotion = {
  duration: motion.note.rowDuration,
  delay: motion.note.rowDelay,
  stagger: motion.note.rowStagger,
  offset: motion.note.rowOffset,
};

export function noteMotion(reduceMotion: boolean): NoteMotion | null {
  return reduceMotion ? null : NOTE;
}

// INFO: each row starts one stagger after the row before it, from the first delay.
export function rowMotion(note: NoteMotion | null, index: number): RowMotion | null {
  if (note === null) return null;
  return {
    duration: note.duration,
    delay: note.delay + Math.max(0, index) * note.stagger,
    offset: note.offset,
  };
}
