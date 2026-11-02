import type { ApiResponse } from "../types/auth";
import type {
  Entitlement,
  EntitlementCheckResponse,
} from "../types/entitlements";

import { apiClient } from "./axios";

function tenantHeaders(tenantId: string) {
  return { "x-tenant-id": tenantId };
}

/**
 * Get all entitlements for the authenticated tenant
 */
export async function getEntitlements(tenantId: string): Promise<Entitlement[]> {
  const response = await apiClient.get<ApiResponse<Entitlement[]>>(
    "/tenant/entitlements",
    { headers: tenantHeaders(tenantId) }
  );
  return response.data.data;
}

/**
 * Check capacity for a product (e.g. before creating a course)
 */
export async function checkEntitlement(
  tenantId: string,
  productCode: string,
  amount = 1
): Promise<EntitlementCheckResponse> {
  const params = new URLSearchParams({ product_code: productCode });
  if (amount !== 1) params.set("amount", String(amount));
  const response = await apiClient.get<ApiResponse<EntitlementCheckResponse>>(
    `/tenant/entitlements/check?${params.toString()}`,
    { headers: tenantHeaders(tenantId) }
  );
  return response.data.data;
}

/**
 * Reconcile usage counters for the authenticated tenant
 */
export async function reconcileUsage(
  tenantId: string
): Promise<Record<string, unknown>> {
  const response = await apiClient.post<ApiResponse<Record<string, unknown>>>(
    "/tenant/entitlements/reconcile",
    {},
    { headers: tenantHeaders(tenantId) }
  );
  return response.data.data;
}

export const entitlementsApi = {
  getEntitlements,
  checkEntitlement,
  reconcileUsage,
};
