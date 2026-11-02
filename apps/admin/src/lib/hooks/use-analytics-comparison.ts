import { useQuery } from "@tanstack/react-query";

import { analyticsApi } from "@/lib/api/analytics";
import { useAnalyticsDateRange } from "@/lib/contexts/analytics-date-range-context";
import { useTenantStore } from "@/lib/stores/tenant-store";

/**
 * Fetches previous-period overview data for comparison.
 * Only fires when comparison is enabled in the date range context.
 */
export function useAnalyticsOverviewComparison() {
  const { dateRange, refreshKey } = useAnalyticsDateRange();
  const tenantId = useTenantStore((s) => s.selectedTenantId);

  const { compareStartDate, compareEndDate, compareEnabled } = dateRange;

  const query = useQuery({
    queryKey: [
      "bi-analytics",
      "overview-comparison",
      tenantId,
      compareStartDate,
      compareEndDate,
      refreshKey,
    ],
    queryFn: () => analyticsApi.getOverview(compareStartDate!, compareEndDate!),
    enabled: !!tenantId && !!compareEnabled && !!compareStartDate && !!compareEndDate,
    staleTime: 60_000,
  });

  return {
    data: query.data,
    isLoading: query.isLoading,
    isComparing: !!compareEnabled,
  };
}
