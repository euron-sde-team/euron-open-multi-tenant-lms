import { CustomError } from "./custom.error";

export class ForbiddenError extends CustomError {
  statusCode = 403;

  reason = "No route exists";

  code?: string;

  constructor(message?: string, code?: string) {
    super(message || "Not Found");
    if (message) this.reason = message;
    this.code = code;
    Object.setPrototypeOf(this, ForbiddenError.prototype);
  }

  serializeErrors() {
    return {
      message: this.reason,
      ...(this.code ? { code: this.code } : {}),
    };
  }
}