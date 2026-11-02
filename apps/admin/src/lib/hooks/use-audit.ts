import { keepPreviousData, useQuery } from "@tanstack/react-query";

import { auditApi, type AuditLogFilters } from "../api/audit";

export const auditKeys = {
  all: ["audit"] as const,
  list: (filters: AuditLogFilters) =>
    [...auditKeys.all, "list", filters] as const,
  filterOptions: () => [...auditKeys.all, "filter-options"] as const,
};

export function useAuditLogs(filters: AuditLogFilters) {
  return useQuery({
    queryKey: auditKeys.list(filters),
    queryFn: () => auditApi.list(filters),
    // Paging shouldn't blank the table out under the reader.
    placeholderData: keepPreviousData,
  });
}

export function useAuditFilterOptions() {
  return useQuery({
    queryKey: auditKeys.filterOptions(),
    queryFn: auditApi.filterOptions,
    staleTime: 5 * 60 * 1000,
  });
}
