import { useEffect } from "react";

import { useEnabledFeatures } from "@/lib/hooks/use-applications";
import {
  useFeatureAccessStore,
  type FeatureAccessInfo,
} from "@/lib/stores/feature-access-store";

/**
 * Populates the feature access store from the resolved features API.
 * Call once in the dashboard layout.
 */
export function usePopulateFeatureAccess(
  tenantId: string | undefined,
  applicationCode: string | undefined
) {
  const { featuresMap, isLoading } = useEnabledFeatures(tenantId, applicationCode);
  const populate = useFeatureAccessStore((s) => s.populate);
  const clearFeatureAccess = useFeatureAccessStore((s) => s.clearFeatureAccess);

  useEffect(() => {
    if (!tenantId) {
      clearFeatureAccess();
      return;
    }
    if (!isLoading) {
      populate(featuresMap);
    }
  }, [tenantId, applicationCode, featuresMap, isLoading, populate, clearFeatureAccess]);
}

/**
 * Convenience hook: get feature access info for a single feature key.
 */
export function useFeatureAccess(featureKey: string): FeatureAccessInfo {
  return useFeatureAccessStore((s) => s.getFeatureAccess(featureKey));
}
