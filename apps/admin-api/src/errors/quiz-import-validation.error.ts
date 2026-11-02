import { CustomError } from "./custom.error";

/**
 * 400 returned when an uploaded quiz questions CSV contains invalid rows.
 * The whole file is rejected; `rowErrors` lists every problem with its row
 * number so the admin can fix the sheet and re-upload in one pass.
 */
export class QuizImportValidationError extends CustomError {
  statusCode = 400;

  constructor(
    message: string,
    public readonly rowErrors: string[]
  ) {
    super(message);
    Object.setPrototypeOf(this, QuizImportValidationError.prototype);
  }

  serializeErrors() {
    return {
      message: this.message,
      rowErrors: this.rowErrors,
    };
  }
}
