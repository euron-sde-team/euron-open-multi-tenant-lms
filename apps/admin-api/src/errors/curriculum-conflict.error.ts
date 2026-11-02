import { CustomError } from "./custom.error";

export type CurriculumConflictCode = "STALE_CURRICULUM";

export interface CurriculumConflictDetails {
  code: CurriculumConflictCode;
  scope: "sections" | "lessons";
  missingIds?: string[];
  unexpectedIds?: string[];
}

/**
 * 409 returned when a bulk reorder/move payload no longer matches the server's
 * current sibling set (another writer added/deleted/moved a row since the client
 * loaded). The frontend should refetch the curriculum and let the user retry.
 */
export class CurriculumConflictError extends CustomError {
  statusCode = 409;

  constructor(
    message: string,
    public readonly details: CurriculumConflictDetails
  ) {
    super(message);
    Object.setPrototypeOf(this, CurriculumConflictError.prototype);
  }

  serializeErrors() {
    return {
      message: this.message,
      code: this.details.code,
      scope: this.details.scope,
      missingIds: this.details.missingIds,
      unexpectedIds: this.details.unexpectedIds,
    };
  }
}
