import { motion } from "@/constants/theme";
import type { EnterMotion } from "@/utils/chat-motion";

export type OfflineMotion = {
  rise: EnterMotion;
  ring: {
    delays: readonly number[];
    cycle: number;
    from: number;
    to: number;
    opacity: number;
    curve: readonly [number, number, number, number];
  };
  spin: number;
};

// INFO: built once at module level. offline.html: the content rises once, the two rings loop with the
// second one starting 1.2 s after the first, and the retrying spinner turns once every .9 s.
const OFFLINE: OfflineMotion = {
  rise: {
    duration: motion.offline.riseDuration,
    offset: motion.offline.riseOffset,
    curve: motion.easeOut,
  },
  ring: {
    delays: [0, motion.offline.ringDelay],
    cycle: motion.offline.ringCycle,
    from: motion.offline.ringFrom,
    to: motion.offline.ringTo,
    opacity: motion.offline.ringOpacity,
    curve: motion.easeOut,
  },
  spin: motion.offline.spinCycle,
};

export function offlineMotion(reduceMotion: boolean): OfflineMotion | null {
  return reduceMotion ? null : OFFLINE;
}
