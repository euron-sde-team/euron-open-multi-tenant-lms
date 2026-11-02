import { TenantOfferingsSummary } from "./tenant-offerings.type";

export type TenantActivityStatus = "active" | "dormant" | "inactive";

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
  /** owner contact, resolved from tenant_users via tenants.owner_user_id */
  ownerEmail: string | null;
  ownerPhone: string | null;
  /** default platform URL, always https://{slug}.{ROOT_DOMAIN} */
  platformUrl: string;
  /** custom domain URL, separate from the platform URL (null if none) */
  customUrl: string | null;
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

export interface TenantActivityEntry {
  at: string;
  kind: "product_usage" | "admin_usage" | "app_status";
  summary: string;
  product: string | null;
  actor: string | null;
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
  offerings: TenantOfferingsSummary;
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

export interface TenantAnalyticsQuery {
  page?: number;
  limit?: number;
  search?: string;
  status?: TenantActivityStatus;
  sort?: "recent_activity" | "name" | "courses" | "members" | "created";
  inactiveDays?: number;
  planCode?: string;
}

export interface SendTenantEmailInput {
  to?: string;
  subject: string;
  html: string;
}

