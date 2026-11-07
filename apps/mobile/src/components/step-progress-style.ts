export function progressSegments(step: number, total: number): boolean[] {
  const filled = Math.min(Math.max(step, 0), total);
  return Array.from({ length: total }, (_, index) => index < filled);
}
