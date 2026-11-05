// Test helper (not a test file): builds a throwaway secret at runtime so no
// test file holds a password or secret literal.

export function generatedSecret(label: string): string {
  return `${label}-${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`;
}
