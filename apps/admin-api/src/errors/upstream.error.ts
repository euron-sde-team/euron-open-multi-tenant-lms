import { CustomError } from "./custom.error";

/**
 * An external dependency (video service, AI provider) failed or is not
 * configured. statusCode is 502 (bad upstream answer), 503 (not configured or
 * unreachable) or 409 (upstream resource not ready).
 */
export class UpstreamError extends CustomError {
  statusCode: number;

  reason: string;

  constructor(message: string, statusCode = 502) {
    super(message);
    this.reason = message;
    this.statusCode = statusCode;
    Object.setPrototypeOf(this, UpstreamError.prototype);
  }

  serializeErrors() {
    return { message: this.reason };
  }
}
