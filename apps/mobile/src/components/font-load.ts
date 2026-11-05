export function isFontLoadSettled(loaded: boolean, error: Error | null): boolean {
  return loaded || error !== null;
}
