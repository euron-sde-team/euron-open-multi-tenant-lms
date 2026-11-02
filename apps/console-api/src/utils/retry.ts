/**
 * Retry an async function with exponential backoff + jitter.
 *
 * - Caller decides which errors are retriable via `isRetriable(err)`.
 * - `onRetriableError` fires before each backoff sleep (used by the campaign
 *   worker to signal its rate limiter to slow down).
 * - Last failure is re-thrown if retries are exhausted.
 */

export interface RetryOptions {
  /** Total attempts including the first one. Default: 4. */
  maxAttempts?: number;
  /** Base delay before the first retry. Default: 500 ms. */
  baseDelayMs?: number;
  /** Hard cap on a single backoff sleep. Default: 30 000 ms. */
  maxDelayMs?: number;
  /** Predicate: should this error be retried? */
  isRetriable: (err: unknown) => boolean;
  /** Side-channel hook: called once per retriable failure, before sleeping. */
  onRetriableError?: (err: unknown, attempt: number) => void;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function retryAsync<T>(
  fn: () => Promise<T>,
  opts: RetryOptions,
): Promise<T> {
  const {
    maxAttempts = 4,
    baseDelayMs = 500,
    maxDelayMs = 30_000,
    isRetriable,
    onRetriableError,
  } = opts;

  let lastErr: unknown;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      if (attempt >= maxAttempts || !isRetriable(err)) {
        throw err;
      }
      onRetriableError?.(err, attempt);
      const exp = Math.min(
        maxDelayMs,
        baseDelayMs * Math.pow(2, attempt - 1),
      );
      const jitter = Math.random() * baseDelayMs;
      await sleep(exp + jitter);
    }
  }
  throw lastErr;
}
