import type { AnswerGradePayload, PracticeKind } from "@fluency-lab/shared";

const MAX_EXPLANATION = 300;

// INFO: trim, lower case, one space between words, straight quotes and no final
// . ! ? or … so the same answer written a little differently still matches.
export function normalizeAnswer(text: string): string {
  const straight = text.replace(/[’‘]/g, "'").replace(/[“”]/g, '"');
  const spaced = straight.trim().toLowerCase().replace(/\s+/g, " ");
  return spaced.replace(/[.!?…\s]+$/u, "").trim();
}

export function matchesAccepted(answer: string, accepted: readonly string[]): boolean {
  const normalized = normalizeAnswer(answer);
  if (normalized === "") return false;
  return accepted.some((entry) => normalizeAnswer(entry) === normalized);
}

export function gradeChoice(picked: string, accepted: readonly string[]): boolean {
  return matchesAccepted(picked, accepted);
}

// INFO: choose is graded here always. A typed answer that matches is right without
// a tutor call; one that does not match is left to the tutor ("ask").
export function localGrade(
  item: { kind: PracticeKind; accepted: readonly string[] },
  answer: string,
): "right" | "miss" | "ask" {
  if (matchesAccepted(answer, item.accepted)) return "right";
  return item.kind === "choose" ? "miss" : "ask";
}

export function toAnswerGrade(payload: AnswerGradePayload): {
  correct: boolean;
  explanation: string | null;
} {
  const explanation = payload.explanation.trim().slice(0, MAX_EXPLANATION).trim();
  return { correct: payload.correct, explanation: explanation === "" ? null : explanation };
}
