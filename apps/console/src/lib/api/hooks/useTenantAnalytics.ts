import { useMutation, useQuery } from 'react-query';

import {
  type TenantAnalyticsDetail,
  type TenantAnalyticsFilters,
  type TenantAnalyticsListResponse,
  getTenantAnalyticsDetail,
  listTenantAnalytics,
  sendTenantEmail,
} from '../tenantAnalytics';

export const useGetTenantAnalytics = (filters?: TenantAnalyticsFilters) =>
  useQuery<TenantAnalyticsListResponse, Error>({
    queryKey: ['tenant-analytics', filters],
    queryFn: () => listTenantAnalytics(filters),
    staleTime: 30000,
    refetchOnWindowFocus: false,
    keepPreviousData: true,
  });

export const useGetTenantAnalyticsDetail = (id: string | undefined) =>
  useQuery<TenantAnalyticsDetail, Error>({
    queryKey: ['tenant-analytics', 'detail', id],
    queryFn: () => getTenantAnalyticsDetail(id as string),
    enabled: !!id,
    staleTime: 30000,
    refetchOnWindowFocus: false,
  });

export const useSendTenantEmail = (id: string | undefined) =>
  useMutation<
    { to: string; providerMessageId?: string },
    Error,
    { to?: string; subject: string; html: string }
  >({
    mutationFn: (payload) => sendTenantEmail(id as string, payload),
  });
