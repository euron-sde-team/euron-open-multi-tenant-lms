import type { AvailableRoutesResponse } from "@open-mtlms/shared";
import { useQuery } from "@tanstack/react-query";

import { routesApi } from "../api/routes";

export const availableRoutesKeys = {
  all: ["available-routes"] as const,
  list: (tenantId: string) => [...availableRoutesKeys.all, tenantId] as const,
};

export function useAvailableRoutesQuery(
  tenantId: string | undefined
): {
  data: AvailableRoutesResponse | undefined;
  isLoading: boolean;
  refetch: () => void;
} {
  const query = useQuery<AvailableRoutesResponse>({
    queryKey: availableRoutesKeys.list(tenantId ?? ""),
    queryFn: () => routesApi.getAvailableRoutes(),
    enabled: !!tenantId,
  });

  return {
    data: query.data,
    isLoading: query.isLoading,
    refetch: query.refetch,
  };
}
