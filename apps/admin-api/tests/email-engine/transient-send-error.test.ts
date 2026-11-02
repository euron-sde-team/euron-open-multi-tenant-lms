import { describe, it, expect } from "vitest";

import { isTransientSendError } from "../../src/services/email-engine/errors";

/**
 * isTransientSendError decides defer-vs-terminalise for campaign sends:
 * `true` leaves the recipient PENDING for another pass; `false` burns them
 * to FAILED permanently. Both directions matter, a false positive hot-loops
 * on a send that can never succeed, a false negative silently drops a
 * recipient on a network blip (the class of bug behind the 15-sent stall).
 *
 * Shapes covered: AWS SDK v3 service errors ($retryable / $metadata),
 * Node socket errors (bare `code`), and garbage inputs.
 */
describe("isTransientSendError", () => {
  describe("transient → defer (returns true)", () => {
    it("trusts the SDK's own retryable classification", () => {
      expect(isTransientSendError({ $retryable: { throttling: true } })).toBe(true);
      expect(isTransientSendError({ $retryable: {} })).toBe(true);
    });

    it("treats 5xx and 429 as transient", () => {
      expect(isTransientSendError({ $metadata: { httpStatusCode: 500 } })).toBe(true);
      expect(isTransientSendError({ $metadata: { httpStatusCode: 503 } })).toBe(true);
      expect(isTransientSendError({ $metadata: { httpStatusCode: 429 } })).toBe(true);
    });

    it("recognises SES throttling by error name", () => {
      expect(isTransientSendError({ name: "ThrottlingException" })).toBe(true);
      expect(isTransientSendError({ name: "TooManyRequestsException" })).toBe(true);
      expect(isTransientSendError({ name: "ServiceUnavailableException" })).toBe(true);
    });

    it("recognises Node socket-level failures", () => {
      expect(isTransientSendError({ code: "ECONNRESET" })).toBe(true);
      expect(isTransientSendError({ code: "ETIMEDOUT" })).toBe(true);
      expect(isTransientSendError({ code: "EAI_AGAIN" })).toBe(true);
      expect(isTransientSendError({ code: "ECONNREFUSED" })).toBe(true);
      expect(isTransientSendError({ name: "TimeoutError" })).toBe(true);
    });
  });

  describe("permanent → terminalise (returns false)", () => {
    it("client errors other than 429 fail identically on retry", () => {
      expect(isTransientSendError({ $metadata: { httpStatusCode: 400 } })).toBe(false);
      expect(isTransientSendError({ $metadata: { httpStatusCode: 403 } })).toBe(false);
      // MessageRejected (bad address / unverified identity) is a 400
      expect(
        isTransientSendError({ name: "MessageRejected", $metadata: { httpStatusCode: 400 } }),
      ).toBe(false);
    });

    it("4xx wins over a scary-looking name, the status is authoritative", () => {
      // e.g. a 400 whose message mentions a timeout in the payload
      expect(
        isTransientSendError({ name: "BadRequestException", $metadata: { httpStatusCode: 400 } }),
      ).toBe(false);
    });

    it("unknown errors default to terminal (conservative)", () => {
      expect(isTransientSendError(new Error("something novel"))).toBe(false);
      expect(isTransientSendError({ name: "ValidationError" })).toBe(false);
    });

    it("garbage inputs never throw and never defer", () => {
      expect(isTransientSendError(null)).toBe(false);
      expect(isTransientSendError(undefined)).toBe(false);
      expect(isTransientSendError("ECONNRESET")).toBe(false); // string, not object
      expect(isTransientSendError(42)).toBe(false);
    });
  });

  it("$retryable wins even alongside a 4xx status (SDK knows best)", () => {
    expect(
      isTransientSendError({ $retryable: { throttling: true }, $metadata: { httpStatusCode: 400 } }),
    ).toBe(true);
  });
});
