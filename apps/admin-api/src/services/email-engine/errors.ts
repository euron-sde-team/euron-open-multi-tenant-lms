/**
 * EmailError, typed errors thrown by the email engine.
 *
 * `retryable=true` means the caller (typically a BullMQ worker) can re-enqueue
 * the send safely. `retryable=false` means the send was rejected for a reason
 * that won't change without external action (suppression list, paused tenant,
 * unverified domain).
 *
 * Getting `retryable` RIGHT matters more than it looks. Callers use it to pick
 * between "leave this recipient PENDING and try again" and "mark it FAILED and
 * move on", so a false positive loops forever on a send that can never
 * succeed, and a false negative permanently burns a recipient on a blip.
 */
export type EmailErrorCode =
  | "SUPPRESSED"
  | "TENANT_PAUSED_FOR_CATEGORY"
  | "NO_VERIFIED_DOMAIN"
  | "RENDER_FAILED"
  | "RATE_LIMITED"
  | "SES_FAILED";

export class EmailError extends Error {
  public readonly code: EmailErrorCode;
  public readonly retryable: boolean;

  constructor(code: EmailErrorCode, message: string, retryable = false) {
    super(message);
    this.name = "EmailError";
    this.code = code;
    this.retryable = retryable;
  }
}

/**
 * True for send failures worth retrying rather than terminalising.
 *
 * Shared by `sender.ts` (to stamp `retryable` on SES_FAILED) and by the
 * campaign worker (to classify raw throwables from the legacy SES path, which
 * never pass through EmailError at all). Keeping one definition means the two
 * paths cannot disagree about what "transient" means.
 *
 * Deliberately conservative: unrecognised errors return false and terminalise.
 * A recipient wrongly marked FAILED is visible in the campaign UI and can be
 * re-sent; a recipient wrongly retried forever is an invisible hot loop.
 *
 * AWS SDK v3 shapes: `$retryable` is attached by the SDK's own classifier,
 * `$metadata.httpStatusCode` carries the HTTP status. Node socket errors
 * surface as `code` (ECONNRESET etc.) with no AWS metadata.
 */
export function isTransientSendError(err: unknown): boolean {
  if (!err || typeof err !== "object") return false;
  const e = err as {
    name?: string;
    code?: string;
    $retryable?: { throttling?: boolean };
    $metadata?: { httpStatusCode?: number };
  };

  // The SDK already decided this is retryable (throttling, transient 5xx).
  if (e.$retryable) return true;

  const status = e.$metadata?.httpStatusCode;
  if (typeof status === "number" && (status >= 500 || status === 429)) return true;

  // 4xx other than 429 is a client error: malformed address, message rejected,
  // unverified identity. Retrying those produces the identical failure.
  if (typeof status === "number" && status >= 400) return false;

  const label = `${e.name ?? ""}|${e.code ?? ""}`;
  return /Throttl|TooManyRequests|ServiceUnavailable|RequestTimeout|TimeoutError|ECONNRESET|ETIMEDOUT|EAI_AGAIN|ENOTFOUND|EPIPE|ECONNREFUSED|NetworkingError|SocketError/i.test(
    label,
  );
}
