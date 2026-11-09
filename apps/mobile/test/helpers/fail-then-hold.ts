// Test helper (not a test file): makes a fake read fail on its first call and hold its second call
// open until release() is called, which then answers it as the fake did before. It lets a test
// look at the screen while Try again is still reading. Call it before the hook renders, with the
// fake already reset.

import type { jest } from "@jest/globals";

export function failThenHold<A extends unknown[], R>(
  read: jest.Mock<(...args: A) => Promise<R>>,
  failure: R,
): { release: () => void } {
  const answer = read.getMockImplementation();
  if (answer === undefined) throw new Error("the fake read has no answer to hold");
  let release: () => void = () => undefined;
  read
    .mockImplementationOnce(() => Promise.resolve(failure))
    .mockImplementationOnce(
      (...args) =>
        new Promise<R>((resolve) => {
          release = () => resolve(answer(...args));
        }),
    );
  return { release: () => release() };
}
