import type { PracticeSlot } from "@/utils/practice-slots";

// INFO: the everyday situations a write attempt is set in. The code picks one per write, so a
// rewrite never gets the same request as the attempt before it.
export const SCENARIOS: readonly string[] = [
  "a train trip",
  "a job interview",
  "cooking dinner",
  "a football match",
  "a family lunch",
  "the supermarket",
  "a doctor's appointment",
  "an exam at school",
  "a garden",
  "a concert",
  "a new pet",
  "moving to a new apartment",
  "a birthday party",
  "a camping trip",
  "a broken phone",
  "saving money",
  "learning to drive",
  "a visit to a museum",
  "a day at the beach",
  "a noisy neighbor",
  "a work meeting",
  "a film night",
  "a gym class",
  "a lost suitcase at the airport",
];

export type PracticeSeed = { scenario: string };

// INFO: each write moves seven scenarios on; 7 and 24 are coprime, so 24 writes in a row never
// repeat a scenario.
const SCENARIO_STEP = 7;

// INFO: FNV-1a over the UTF-16 code units, 32 bits unsigned: stable across runs and devices, so
// the reducer stays pure and a seed can be asserted exactly.
export function stableHash(text: string): number {
  let hash = 0x811c9dc5;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash;
}

// INFO: the scenario of the run's write number writeCount, from an offset stable for the run.
// writeCount only grows, so a retry never gets a scenario the run already used within 24 writes.
export function seedFor(input: { runId: string; writeCount: number }): PracticeSeed {
  const total = SCENARIOS.length;
  const offset = stableHash(input.runId) % total;
  return { scenario: SCENARIOS[(offset + input.writeCount * SCENARIO_STEP) % total] ?? "" };
}

// INFO: a fix on a learner's own correction keeps the learner's sentence, so it takes no seed.
export function takesSeed(slot: PracticeSlot): boolean {
  return !(
    slot.kind === "fix" &&
    slot.target.focus === "mistakes" &&
    slot.target.correction !== null
  );
}
