import { CustomError } from "./custom.error";

export interface EntitlementConflict {
  feature_key: string;
  product_code: string;
  application_code: string;
  current_used: number;
  new_limit: number;
  /** true when the new plan doesn't include this feature at all */
  dropped: boolean;
}

/**
 * Thrown when a plan change would result in entitlement usage exceeding new limits.
 * Returns a structured response with the list of conflicts so the admin can decide
 * whether to force the assignment.
 */
export class EntitlementConflictError extends CustomError {
  statusCode = 409;
  conflicts: EntitlementConflict[];

  constructor(conflicts: EntitlementConflict[]) {
    super("Usage on existing entitlements exceeds the new plan's limits");
    this.conflicts = conflicts;
    Object.setPrototypeOf(this, EntitlementConflictError.prototype);
  }

  serializeErrors() {
    return {
      message: this.message,
      code: "ENTITLEMENT_LIMIT_EXCEEDED",
      conflicts: this.conflicts,
    };
  }
}
