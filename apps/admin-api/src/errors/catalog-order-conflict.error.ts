import { CustomError } from "./custom.error";

export type CatalogOrderConflictCode = "STALE_CATALOG";

/** Which catalog list the conflicting reorder was for. */
export type CatalogOrderScope =
  | "courses"
  | "books"
  | "bundles"
  | "batches"
  | "test_series";

export interface CatalogOrderConflictDetails {
  code: CatalogOrderConflictCode;
  scope: CatalogOrderScope;
  missingIds?: string[];
  unexpectedIds?: string[];
}

/**
 * 409 returned when a catalog reorder payload no longer matches the server's
 * current row set, another admin published, deleted, or created an item since
 * this client loaded the list.
 *
 * Writing a partial order would silently strand the rows the client never knew
 * about at whatever sort_order they happen to hold, interleaving them
 * arbitrarily. Better to reject and have the client refetch.
 *
 * Mirrors CurriculumConflictError (STALE_CURRICULUM) for the section/lesson
 * drag-and-drop; same contract, different scope.
 */
export class CatalogOrderConflictError extends CustomError {
  statusCode = 409;

  constructor(
    message: string,
    public readonly details: CatalogOrderConflictDetails
  ) {
    super(message);
    Object.setPrototypeOf(this, CatalogOrderConflictError.prototype);
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
