import { CustomError } from "./custom.error";

export type EntitlementErrorCode = "ENTITLEMENT_FEATURE_DISABLED" | "ENTITLEMENT_LIMIT_REACHED" | "STORAGE_LIMIT_REACHED";

export interface EntitlementErrorDetails {
  code: EntitlementErrorCode;
  productCode?: string;
  featureKey?: string;
  currentUsed?: number;
  limit?: number;
  isUnlimited?: boolean;
}

/**
 * 403 error for entitlement check failures.
 * Serializes to a shape the frontend can use for messaging and upgrade CTA.
 */
export class EntitlementForbiddenError extends CustomError {
  statusCode = 403;

  constructor(
    message: string,
    public readonly details: EntitlementErrorDetails
  ) {
    super(message);
    Object.setPrototypeOf(this, EntitlementForbiddenError.prototype);
  }

  serializeErrors() {
    return {
      message: this.message,
      code: this.details.code,
      productCode: this.details.productCode,
      featureKey: this.details.featureKey,
      currentUsed: this.details.currentUsed,
      limit: this.details.limit,
      isUnlimited: this.details.isUnlimited,
    };
  }
}
