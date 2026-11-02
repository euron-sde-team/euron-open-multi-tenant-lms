import { CustomError } from "./custom.error";

export class UnauthorizedError extends CustomError {
  statusCode = 401;

  reason = "Not Authorized";

  code?: string;

  constructor(message?: string, code?: string) {
    super(message || "Not Authorized");
    if (message) {
      this.reason = message;
    }
    this.code = code;
    Object.setPrototypeOf(this, UnauthorizedError.prototype);
  }


  /**
   * Only code-carrying errors expose their real message. 401s are raised all
   * over the auth path ("Invalid token", "Invalid email or password", …) and
   * several are deliberately vague; opting in per-error keeps that intact while
   * letting account-status failures tell the learner what actually happened.
   */
  serializeErrors() {
    return this.code
      ? { message: this.reason, code: this.code }
      : { message: "Not authorized" };
  }
}
