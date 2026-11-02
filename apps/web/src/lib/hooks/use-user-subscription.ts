import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { userSubscriptionsApi } from "../api/user-subscriptions";

export const userSubKeys = {
  all: ["user-subscription"] as const,
  plans: () => [...userSubKeys.all, "plans"] as const,
  my: () => [...userSubKeys.all, "my"] as const,
  access: () => [...userSubKeys.all, "access"] as const,
};

export function useSubscriptionPlans() {
  return useQuery({
    queryKey: userSubKeys.plans(),
    queryFn: userSubscriptionsApi.listPlans,
  });
}

export function useMySubscription() {
  return useQuery({
    queryKey: userSubKeys.my(),
    queryFn: userSubscriptionsApi.getMySubscription,
  });
}

export function useSubscriptionAccess() {
  return useQuery({
    queryKey: userSubKeys.access(),
    queryFn: userSubscriptionsApi.checkAccess,
    staleTime: 5 * 60 * 1000,
  });
}

export function useSubscribe() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: userSubscriptionsApi.subscribe,
    onSuccess: () => qc.invalidateQueries({ queryKey: userSubKeys.all }),
  });
}

export function useVerifySubscriptionAuth() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: userSubscriptionsApi.verifyAuth,
    onSuccess: () => qc.invalidateQueries({ queryKey: userSubKeys.all }),
  });
}

export function useCancelMySubscription() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (cancelAtPeriodEnd?: boolean) =>
      userSubscriptionsApi.cancelSubscription(cancelAtPeriodEnd),
    onSuccess: () => qc.invalidateQueries({ queryKey: userSubKeys.all }),
  });
}
