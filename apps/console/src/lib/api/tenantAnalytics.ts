import apiClient from './client';

export type TenantActivityStatus = 'active' | 'dormant' | 'inactive';

export interface TenantAnalyticsRow {
  id: string;
  name: string;
  slug: string;
  status: string;
  activityStatus: TenantActivityStatus;
  createdAt: string;
  lastActivityAt: string | null;
  memberCount: number;
  recentLoginCount: number;
  activeAppCount: number;
  courseCount: number;
  plan: string | null;
  planCode: string | null;
  subscriptionStatus: string | null;
  validUntil: string | null;
  customDomain: string | null;
  liveUrl: string | null;
  ownerEmail: string | null;
  ownerPhone: string | null;
  platformUrl: string;
  customUrl: string | null;
}

export interface TenantActivityEntry {
  at: string;
  kind: 'product_usage' | 'admin_usage' | 'app_status';
  summary: string;
  product: string | null;
  actor: string | null;
}

export interface TenantActivityItem {
  tenantId: string;
  tenantName: string;
  type: string;
  detail: string;
  at: string;
}

export interface TenantAnalyticsOverview {
  totalTenants: number;
  activeTenants: number;
  dormantTenants: number;
  inactiveTenants: number;
  activeSubscriptions: number;
  totalMembers: number;
  inactiveDays: number;
  signupsByMonth: { month: string; count: number }[];
  recentActivity: TenantActivityItem[];
}

export interface TenantAnalyticsListResponse {
  data: TenantAnalyticsRow[];
  overview: TenantAnalyticsOverview;
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface TenantFeatureUsage {
  featureKey: string;
  productCode: string;
  applicationCode: string;
  isUnlimited: boolean;
  limitValue: number;
  currentUsage: number;
  used: boolean;
}

export interface OfferingGroup {
  key: string;
  count: number | string;
}

export interface TenantAnalyticsDetail {
  tenant: {
    id: string;
    name: string;
    slug: string;
    status: string;
    createdAt: string;
    ownerEmail: string | null;
    ownerPhone: string | null;
    customDomain: string | null;
    liveUrl: string | null;
    platformUrl: string;
    customUrl: string | null;
  };
  activityStatus: TenantActivityStatus;
  lastActivityAt: string | null;
  inactiveDays: number;
  members: { total: number; recentLogins: number };
  subscription: {
    plan: string;
    planCode: string;
    status: string;
    currentPeriodEnd: string | null;
    validUntil: string | null;
  } | null;
  recentActivity: TenantActivityEntry[];
  // offerings is the raw summary object from the backend (courses/books/... groupings)
  offerings: Record<string, unknown>;
  offeringCounts: {
    courses: number;
    books: number;
    bundles: number;
    batches: number;
    testSeries: number;
  };
  featuresUsed: TenantFeatureUsage[];
  featuresUnused: TenantFeatureUsage[];
}

export interface TenantAnalyticsFilters {
  page?: number;
  limit?: number;
  search?: string;
  status?: TenantActivityStatus;
  sort?: 'recent_activity' | 'name' | 'courses' | 'members' | 'created';
  inactiveDays?: number;
  planCode?: string;
}

const BASE = '/admin/tenant-analytics';

export const listTenantAnalytics = async (
  filters?: TenantAnalyticsFilters,
): Promise<TenantAnalyticsListResponse> => {
  const res = await apiClient.get<{ data: TenantAnalyticsListResponse }>(BASE, {
    params: filters,
  });
  return res.data.data;
};

export const getTenantAnalyticsDetail = async (
  id: string,
): Promise<TenantAnalyticsDetail> => {
  const res = await apiClient.get<{ data: TenantAnalyticsDetail }>(
    `${BASE}/${id}`,
  );
  return res.data.data;
};

export const sendTenantEmail = async (
  id: string,
  payload: { to?: string; subject: string; html: string },
): Promise<{ to: string; providerMessageId?: string }> => {
  const res = await apiClient.post<{
    data: { to: string; providerMessageId?: string };
  }>(`${BASE}/${id}/send-email`, payload);
  return res.data.data;
};

export async function downloadTenantAnalyticsXlsx(
  filters?: TenantAnalyticsFilters,
): Promise<void> {
  const response = await apiClient.get<Blob>(`${BASE}/export`, {
    params: filters,
    responseType: 'blob',
    validateStatus: () => true,
  });
  if (response.status !== 200 || !(response.data instanceof Blob)) {
    throw new Error('Export failed');
  }
  const url = URL.createObjectURL(response.data);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `tenant-analytics-${new Date().toISOString().slice(0, 10)}.xlsx`;
  anchor.rel = 'noopener';
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}
