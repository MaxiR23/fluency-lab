export const DEADLINE = Symbol("deadline");

// INFO: AbortController and setTimeout instead of AbortSignal.timeout, whose
// presence in the React Native runtime is not verified. The timer stays on
// until the work ends, so it covers the body read too; the race settles even
// when the body never does.
export async function withinDeadline<T>(
  timeoutMs: number,
  work: (signal: AbortSignal) => Promise<T>,
): Promise<T | typeof DEADLINE> {
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  const expired = new Promise<typeof DEADLINE>((resolve) => {
    timer = setTimeout(() => {
      controller.abort();
      resolve(DEADLINE);
    }, timeoutMs);
  });
  try {
    return await Promise.race([work(controller.signal), expired]);
  } finally {
    clearTimeout(timer);
  }
}
