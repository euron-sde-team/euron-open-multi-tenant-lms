import { useQuery } from "@tanstack/react-query";

import { batchesApi } from "../api/batches";

// ============================================================================
// REACT QUERY HOOKS FOR BATCHES
// ============================================================================

export const batchKeys = {
  all: ["batches"] as const,
  lists: () => [...batchKeys.all, "list"] as const,
  list: (filters?: { status?: string; search?: string }) =>
    [...batchKeys.lists(), filters] as const,
};

/**
 * List all batches for a tenant.
 */
export const useBatches = (
  page = 1,
  limit = 100,
  filters?: { status?: string; search?: string }
) => {
  return useQuery({
    queryKey: batchKeys.list(filters),
    queryFn: () => batchesApi.getBatches(page, limit, filters),
  });
};
