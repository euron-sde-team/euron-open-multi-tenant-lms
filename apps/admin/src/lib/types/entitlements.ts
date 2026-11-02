/**
 * Entitlement row from GET /tenant/entitlements
 */
export interface Entitlement {
  feature_key: string;
  product_code: string;
  limit_value: number;
  used_value: number;
  is_unlimited: boolean;
  unit?: string;
  source?: string;
  warning?: boolean;
  remainingSlots?: number;
  /** Usage window type: LIFETIME, MONTHLY, YEARLY, DAILY */
  usage_window?: string;
}

export interface EntitlementsListResponse {
  list: Entitlement[];
}

/**
 * Response from GET /tenant/entitlements/check
 */
export interface EntitlementCheckResponse {
  allowed: boolean;
  currentUsed?: number;
  limit?: number;
  isUnlimited?: boolean;
  remainingSlots?: number;
  warning?: boolean;
}

/**
 * Usage summary for a product (e.g. self_paced_courses_count)
 */
export interface ProductUsage {
  used: number;
  limit: number;
  isUnlimited: boolean;
  allowedToAddOne: boolean;
  remainingSlots?: number;
  warning?: boolean;
  /** Usage window type: LIFETIME, MONTHLY, YEARLY, DAILY */
  usageWindow?: string;
}
