import { CustomError } from "./custom.error";

export class ServiceUnavailableError extends CustomError {
  statusCode = 503;

  reason = "Service Unavailable";

  constructor(message?: string) {
    super(message || "Service Unavailable");
    if (message) {
      this.reason = message;
    }
    Object.setPrototypeOf(this, ServiceUnavailableError.prototype);
  }

  serializeErrors() {
    return {
      message: this.reason
    };
  }
}
