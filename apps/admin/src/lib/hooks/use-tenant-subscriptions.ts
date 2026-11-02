import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  tenantSubscriptionsApi,
  type SubscriptionPlan,
  type SubscriptionSettings,
  type SubscriptionAnalytics,
  type SubscriberListResult,
  type SubscriberDetail,
} from "../api/tenant-subscriptions";

export const tenantSubKeys = {
  all: ["tenant-subscriptions"] as const,
  plans: () => [...tenantSubKeys.all, "plans"] as const,
  planDetail: (id: string) => [...tenantSubKeys.all, "plan", id] as const,
  settings: () => [...tenantSubKeys.all, "settings"] as const,
  pageConfig: () => [...tenantSubKeys.all, "page-config"] as const,
  webhookConfig: () => [...tenantSubKeys.all, "webhook-config"] as const,
  subscribers: (filters?: Record<string, unknown>) =>
    [...tenantSubKeys.all, "subscribers", filters] as const,
  subscriberDetail: (id: string) =>
    [...tenantSubKeys.all, "subscriber", id] as const,
};

// ─── Plans ───────────────────────────────────────────────────────────────

export const useSubscriptionPlans = (includeInactive = false) => {
  return useQuery<SubscriptionPlan[]>({
    queryKey: tenantSubKeys.plans(),
    queryFn: () => tenantSubscriptionsApi.listPlans(includeInactive),
  });
};

export const useSubscriptionPlan = (id: string) => {
  return useQuery<SubscriptionPlan>({
    queryKey: tenantSubKeys.planDetail(id),
    queryFn: () => tenantSubscriptionsApi.getPlan(id),
    enabled: !!id,
  });
};

export const useCreateSubscriptionPlan = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: Parameters<typeof tenantSubscriptionsApi.createPlan>[0]) =>
      tenantSubscriptionsApi.createPlan(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: tenantSubKeys.plans() });
    },
  });
};

export const useUpdateSubscriptionPlan = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      ...body
    }: { id: string } & Parameters<typeof tenantSubscriptionsApi.updatePlan>[1]) =>
      tenantSubscriptionsApi.updatePlan(id, body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: tenantSubKeys.all });
    },
  });
};

export const useDeactivateSubscriptionPlan = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => tenantSubscriptionsApi.deactivatePlan(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: tenantSubKeys.plans() });
    },
  });
};

// ─── Settings ────────────────────────────────────────────────────────────

export const useSubscriptionSettings = () => {
  return useQuery<SubscriptionSettings>({
    queryKey: tenantSubKeys.settings(),
    queryFn: () => tenantSubscriptionsApi.getSettings(),
  });
};

export const useUpdateSubscriptionSettings = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: Partial<SubscriptionSettings>) =>
      tenantSubscriptionsApi.updateSettings(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: tenantSubKeys.settings() });
    },
  });
};

// ─── Page Config ────────────────────────────────────────────────────────

export const useSubscriptionPageConfig = () => {
  return useQuery({
    queryKey: tenantSubKeys.pageConfig(),
    queryFn: () => tenantSubscriptionsApi.getPageConfig(),
  });
};

export const useUpdateSubscriptionPageConfig = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (sections: unknown[]) =>
      tenantSubscriptionsApi.updatePageConfig(sections),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: tenantSubKeys.pageConfig() });
    },
  });
};

// ─── Webhook Config ──────────────────────────────────────────────────────

export const useSubscriptionWebhookConfig = () => {
  return useQuery({
    queryKey: tenantSubKeys.webhookConfig(),
    queryFn: () => tenantSubscriptionsApi.getWebhookConfig(),
  });
};

// ─── Analytics ──────────────────────────────────────────────────────────

export const useSubscriptionAnalytics = () => {
  return useQuery<SubscriptionAnalytics>({
    queryKey: [...tenantSubKeys.all, "analytics"],
    queryFn: () => tenantSubscriptionsApi.getAnalytics(),
    staleTime: 60_000,
  });
};

// ─── Subscribers ─────────────────────────────────────────────────────────

export const useSubscribers = (params?: {
  page?: number;
  limit?: number;
  status?: string;
  plan_id?: string;
  search?: string;
}) => {
  return useQuery<SubscriberListResult>({
    queryKey: tenantSubKeys.subscribers(params as Record<string, unknown>),
    queryFn: () => tenantSubscriptionsApi.listSubscribers(params),
    placeholderData: (prev) => prev,
  });
};

export const useSubscriberDetail = (id: string) => {
  return useQuery<SubscriberDetail>({
    queryKey: tenantSubKeys.subscriberDetail(id),
    queryFn: () => tenantSubscriptionsApi.getSubscriber(id),
    enabled: !!id,
  });
};

export const useCancelSubscription = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => tenantSubscriptionsApi.cancelSubscription(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: tenantSubKeys.all });
    },
  });
};

export const usePauseSubscription = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => tenantSubscriptionsApi.pauseSubscription(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: tenantSubKeys.all });
    },
  });
};

export const useResumeSubscription = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => tenantSubscriptionsApi.resumeSubscription(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: tenantSubKeys.all });
    },
  });
};
