import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { entitlementsApi } from "../api/entitlements";
import { useTenantStore } from "../stores/tenant-store";
import type { Entitlement, ProductUsage } from "../types/entitlements";

export const entitlementKeys = {
  all: ["entitlements"] as const,
  list: (tenantId: string) => [...entitlementKeys.all, tenantId] as const,
  check: (tenantId: string, productCode: string, amount?: number) =>
    [...entitlementKeys.all, "check", tenantId, productCode, amount] as const,
};

/**
 * Hook to fetch entitlements for a tenant
 */
export function useEntitlements(tenantId: string | undefined) {
  return useQuery({
    queryKey: entitlementKeys.list(tenantId ?? ""),
    queryFn: () => entitlementsApi.getEntitlements(tenantId!),
    enabled: !!tenantId,
  });
}

/**
 * Hook to check capacity for a product (e.g. before create)
 */
export function useEntitlementCheck(
  tenantId: string | undefined,
  productCode: string,
  amount = 1
) {
  return useQuery({
    queryKey: entitlementKeys.check(tenantId ?? "", productCode, amount),
    queryFn: () =>
      entitlementsApi.checkEntitlement(tenantId!, productCode, amount),
    enabled: !!tenantId && !!productCode,
  });
}

/**
 * Hook to trigger usage reconciliation for the current tenant
 */
export function useReconcileUsage(tenantId: string | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => entitlementsApi.reconcileUsage(tenantId!),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: entitlementKeys.list(tenantId ?? ""),
      });
    },
  });
}

/**
 * Get usage summary for a count product (e.g. self_paced_courses_count)
 */
export function getProductUsage(
  entitlements: Entitlement[] | undefined,
  productCode: string
): ProductUsage {
  const ent = entitlements?.find((e) => e.product_code === productCode);
  if (!ent) {
    // No entitlement record means the product is not granted: denied.
    return {
      used: 0,
      limit: 0,
      isUnlimited: false,
      allowedToAddOne: false,
    };
  }
  const used = ent.used_value;
  const limit = ent.limit_value;
  const isUnlimited = ent.is_unlimited;
  const allowedToAddOne = isUnlimited || used < limit;
  return {
    used,
    limit,
    isUnlimited,
    allowedToAddOne,
    remainingSlots: ent.remainingSlots,
    warning: ent.warning,
    usageWindow: ent.usage_window,
  };
}

/**
 * Derived feature flags from entitlements for UI (quiz, assignment, AI authoring)
 */
export interface AllowedFeatures {
  canCreateSelfPacedCourse: boolean;
  canUseAiAuthoring: boolean;
  canUseQuizzes: boolean;
  canUseAssignments: boolean;
  maxQuizQuestionsPerQuiz: number | null;
}

export function getAllowedFeatures(
  entitlements: Entitlement[] | undefined
): AllowedFeatures {
  const byCode = (code: string) =>
    entitlements?.find((e) => e.product_code === code);
  const enabled = (code: string) => {
    const e = byCode(code);
    // No entitlement record means the feature is not granted: denied.
    if (!e) return false;
    return !!(e.is_unlimited || e.limit_value >= 1);
  };
  const limit = (code: string): number | null => {
    const e = byCode(code);
    if (!e || e.is_unlimited) return null;
    return e.limit_value ?? null;
  };
  return {
    canCreateSelfPacedCourse: enabled("self_paced_courses_enabled"),
    canUseAiAuthoring: enabled("ai_authoring_enabled"),
    canUseQuizzes: enabled("quizzes_enabled"),
    canUseAssignments: enabled("assignments_enabled"),
    maxQuizQuestionsPerQuiz: limit("quiz_questions_per_quiz"),
  };
}

/**
 * Hook that returns allowed features for the current tenant
 */
export function useAllowedFeatures(tenantId: string | undefined) {
  const { data: entitlements } = useEntitlements(tenantId);
  return getAllowedFeatures(entitlements);
}

/**
 * Whether AI authoring (course/book/batch/test/test-series/page generation) is
 * available to the selected tenant. Gated by the `ai_authoring_enabled`
 * entitlement; false while entitlements are loading so AI buttons never flash.
 */
export function useAiAuthoringEnabled(): boolean {
  const tenantId = useTenantStore((s) => s.selectedTenantId) ?? undefined;
  const { data: entitlements, isSuccess } = useEntitlements(tenantId);
  return isSuccess && getAllowedFeatures(entitlements).canUseAiAuthoring;
}
