import { useQuery } from "@tanstack/react-query";

import { plansApi } from "../api/plans";

export const plansKeys = {
  all: ["plans"] as const,
  list: () => [...plansKeys.all, "list"] as const,
  listWithProducts: () => [...plansKeys.all, "list-with-products"] as const,
  eligibility: (planVersionId: string, currency?: string) =>
    [...plansKeys.all, "eligibility", planVersionId, currency] as const,
};

export function usePlans() {
  return useQuery({
    queryKey: plansKeys.list(),
    queryFn: () => plansApi.listPlans(),
  });
}

export function usePlansWithProducts() {
  return useQuery({
    queryKey: plansKeys.listWithProducts(),
    queryFn: () => plansApi.listPlansWithProducts(),
  });
}

export function usePlanEligibility(
  planVersionId: string | undefined,
  currency?: "INR" | "USD"
) {
  return useQuery({
    queryKey: plansKeys.eligibility(planVersionId ?? "", currency),
    queryFn: () => plansApi.getEligibility(planVersionId!, currency),
    enabled: !!planVersionId,
  });
}
