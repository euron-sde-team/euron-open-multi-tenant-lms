import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  subscriptionsApi,
  type CreateCheckoutBody,
  type ReactivateBody,
} from "../api/subscriptions";
import { useTenantStore } from "../stores/tenant-store";

import { applicationKeys } from "./use-applications";
import { entitlementKeys } from "./use-entitlements";
import { sidebarKeys } from "./use-sidebar-config";

export const subscriptionKeys = {
  current: ["subscriptions", "current"] as const,
  renewal: ["subscriptions", "renewal"] as const,
  invoiceUrl: ["subscriptions", "invoice-url"] as const,
};

export function useCurrentSubscription() {
  const selectedTenantId = useTenantStore((s) => s.selectedTenantId);
  return useQuery({
    queryKey: [...subscriptionKeys.current, selectedTenantId],
    queryFn: () => subscriptionsApi.getCurrent(),
    enabled: !!selectedTenantId,
  });
}

export function useInvoiceUrl() {
  const selectedTenantId = useTenantStore((s) => s.selectedTenantId);
  return useQuery({
    queryKey: [...subscriptionKeys.invoiceUrl, selectedTenantId],
    queryFn: () => subscriptionsApi.getInvoiceUrl(),
    enabled: !!selectedTenantId,
  });
}

function invalidateEntitlementDependentQueries(queryClient: ReturnType<typeof useQueryClient>) {
  queryClient.invalidateQueries({ queryKey: applicationKeys.all });
  queryClient.invalidateQueries({ queryKey: entitlementKeys.all });
  queryClient.invalidateQueries({ queryKey: sidebarKeys.all });
}

export function useCreateCheckout() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: CreateCheckoutBody) => subscriptionsApi.createCheckout(body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: subscriptionKeys.current });
      invalidateEntitlementDependentQueries(queryClient);
    },
  });
}

export function useCancelSubscription() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => subscriptionsApi.cancel(id),
    onSuccess: () => {
      // Refetch subscription, it stays ACTIVE with cancelled_at set (graceful cancel)
      queryClient.invalidateQueries({ queryKey: subscriptionKeys.current });
      invalidateEntitlementDependentQueries(queryClient);
    },
  });
}

export function useReactivateSubscription() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: ReactivateBody) => subscriptionsApi.reactivate(body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: subscriptionKeys.current });
      invalidateEntitlementDependentQueries(queryClient);
    },
  });
}

/**
 * Is a payment due on the current plan? Drives the red strip and the lock.
 * `awaitingPayment` polls while the Razorpay tab is open, so the strip clears
 * by itself once the webhook lands.
 */
export function useRenewalStatus(options?: { awaitingPayment?: boolean }) {
  const selectedTenantId = useTenantStore((s) => s.selectedTenantId);
  return useQuery({
    queryKey: [...subscriptionKeys.renewal, selectedTenantId],
    queryFn: () => subscriptionsApi.getRenewal(),
    enabled: !!selectedTenantId,
    staleTime: 60_000,
    refetchInterval: options?.awaitingPayment ? 5_000 : false,
  });
}

export function useStartRenewal() {
  return useMutation({ mutationFn: () => subscriptionsApi.renew() });
}

/** Everything that changes once a renewal payment lands. */
export function invalidateAfterRenewal(queryClient: ReturnType<typeof useQueryClient>) {
  queryClient.invalidateQueries({ queryKey: subscriptionKeys.renewal });
  queryClient.invalidateQueries({ queryKey: subscriptionKeys.current });
  invalidateEntitlementDependentQueries(queryClient);
}
