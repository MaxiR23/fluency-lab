// Test helper (not a test file): redefines the __DEV__ global so a test can
// draw a screen in and out of development. Save the original at module level
// (const savedDev = __DEV__) and call setDev(savedDev) in afterEach.

// INFO: react-native declares __DEV__ as a constant, so the test redefines the global.
export function setDev(value: boolean): void {
  Object.defineProperty(globalThis, "__DEV__", { value, writable: true, configurable: true });
}
