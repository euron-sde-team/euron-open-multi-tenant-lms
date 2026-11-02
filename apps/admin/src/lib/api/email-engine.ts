import { apiClient } from "./axios";

/**
 * Email engine API client: Phase 14.
 *
 * All endpoints under admin-api `/tenant/email-*`. Auth + tenant
 * header are added automatically by the apiClient interceptors.
 *
 * Permission gate: `email_sending.view` for reads, `email_sending.manage`
 * for mutations. The tenant-admin backend enforces; UI should also gate
 * action buttons via useHasPermission for nicer UX.
 */

// ─── Types ───────────────────────────────────────────────────

export type DnsRecordType = "CNAME" | "MX" | "TXT";
export type DnsPurpose =
  | "DKIM"
  | "MAIL_FROM_MX"
  | "MAIL_FROM_SPF"
  | "SENDING_SPF"
  | "DMARC";

export interface DnsRecord {
  type: DnsRecordType;
  name: string;
  value: string;
  priority?: number;
  purpose: DnsPurpose;
}

export type SendingDomainStatus = "PENDING" | "VERIFIED" | "FAILED" | "DISABLED";

export interface SendingDomain {
  id: string;
  tenantId: string;
  /**
   * The sending domain. Despite the name (kept for backwards
   * compatibility with the API field + DB column), this can be either a
   * subdomain (e.g. `mail.example.com`) or an apex domain (e.g. `example.com`).
   * Use `isApex` to tell them apart in the UI.
   */
  subdomain: string;
  mailFromSubdomain: string;
  sesConfigurationSet: string;
  status: SendingDomainStatus;
  dkimStatus: string | null;
  mailFromStatus: string | null;
  dnsRecords: DnsRecord[];
  failureReason: string | null;
  verifiedAt: string | null;
  lastCheckedAt: string | null;
  createdAt: string;
  updatedAt: string;
  /** True when the sending domain is an apex (2 labels, e.g. `example.com`). */
  isApex: boolean;
  /**
   * DMARC TXT already published at `_dmarc.{sendingDomain}` at onboarding
   * time or on the last manual `Check verification` click. Null if no
   * existing record was found. The UI surfaces this so the tenant doesn't
   * blindly overwrite a stricter corporate DMARC policy with our
   * conservative `p=none` recommendation.
   */
  existingDmarcTxt: string | null;
}

export interface OnboardSendingDomainInput {
  subdomain: string;
}

export interface DomainHealthCheck {
  id: string;
  sendingDomainId: string;
  dkimStatus: string;
  mailFromStatus: string;
  spfPresent: boolean;
  dmarcPresent: boolean;
  failures: { check: string; reason: string }[];
  createdAt: string;
}

export type SenderIdentityStatus = "ACTIVE" | "ARCHIVED";

export interface SenderIdentity {
  id: string;
  tenantId: string;
  sendingDomainId: string;
  emailAddress: string;
  displayName: string | null;
  replyTo: string | null;
  status: SenderIdentityStatus;
  isDefaultTransactional: boolean;
  isDefaultNotification: boolean;
  isDefaultMarketing: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateSenderIdentityInput {
  emailAddress: string;
  displayName?: string | null;
  replyTo?: string | null;
  isDefaultTransactional?: boolean;
  isDefaultNotification?: boolean;
  isDefaultMarketing?: boolean;
}

export interface UpdateSenderIdentityInput {
  displayName?: string | null;
  replyTo?: string | null;
  isDefaultTransactional?: boolean;
  isDefaultNotification?: boolean;
  isDefaultMarketing?: boolean;
}

export type TenantSendingStatus =
  | "ACTIVE"
  | "WARNING"
  | "THROTTLED"
  | "PAUSED";

export interface ReputationOverview {
  status: TenantSendingStatus;
  statusChangedAt: string | null;
  marketingBlockedReason: string | null;
  rates: {
    windowStart: string;
    windowEnd: string;
    sent: number;
    delivered: number;
    bouncedPerm: number;
    bouncedTrans: number;
    complained: number;
    opened: number;
    clicked: number;
    permBounceRate: number;
    complaintRate: number;
    deliveryRate: number;
    openRate: number;
  };
  recentEvents: ReputationEvent[];
}

export interface ReputationEvent {
  id: string;
  fromStatus: TenantSendingStatus;
  toStatus: TenantSendingStatus;
  trigger:
    | "AUTO_BOUNCE"
    | "AUTO_COMPLAINT"
    | "AUTO_RECOVERY"
    | "ADMIN_OVERRIDE"
    | "EMERGENCY_BRAKE";
  triggeredBy: string | null;
  reason: string;
  ratesSnapshot: unknown;
  createdAt: string;
}

interface ApiEnvelope<T> {
  success: boolean;
  data: T;
  message: string;
  statusCode: number;
}

// ─── Sending domains ─────────────────────────────────────────

export const emailEngineApi = {
  listSendingDomains: async (): Promise<SendingDomain[]> => {
    const res = await apiClient.get<ApiEnvelope<SendingDomain[]>>(
      "/tenant/email-sending-domains",
    );
    return res.data.data;
  },

  getSendingDomain: async (id: string): Promise<SendingDomain> => {
    const res = await apiClient.get<ApiEnvelope<SendingDomain>>(
      `/tenant/email-sending-domains/${id}`,
    );
    return res.data.data;
  },

  onboardSendingDomain: async (
    input: OnboardSendingDomainInput,
  ): Promise<SendingDomain> => {
    const res = await apiClient.post<ApiEnvelope<SendingDomain>>(
      "/tenant/email-sending-domains",
      input,
    );
    return res.data.data;
  },

  deleteSendingDomain: async (id: string): Promise<void> => {
    await apiClient.delete(`/tenant/email-sending-domains/${id}`);
  },

  checkSendingDomain: async (id: string): Promise<SendingDomain> => {
    const res = await apiClient.post<ApiEnvelope<SendingDomain>>(
      `/tenant/email-sending-domains/${id}/check`,
    );
    return res.data.data;
  },

  getDomainHealth: async (id: string): Promise<DomainHealthCheck | null> => {
    const res = await apiClient.get<ApiEnvelope<DomainHealthCheck | null>>(
      `/tenant/email-sending-domains/${id}/health`,
    );
    return res.data.data;
  },

  runDomainHealthCheck: async (id: string): Promise<DomainHealthCheck> => {
    const res = await apiClient.post<ApiEnvelope<DomainHealthCheck>>(
      `/tenant/email-sending-domains/${id}/check-health`,
    );
    return res.data.data;
  },

  // ─── Sender identities ─────────────────────────────────────

  listSenderIdentities: async (): Promise<SenderIdentity[]> => {
    const res = await apiClient.get<ApiEnvelope<SenderIdentity[]>>(
      "/tenant/email-sender-identities",
    );
    return res.data.data;
  },

  createSenderIdentity: async (
    input: CreateSenderIdentityInput,
  ): Promise<SenderIdentity> => {
    const res = await apiClient.post<ApiEnvelope<SenderIdentity>>(
      "/tenant/email-sender-identities",
      input,
    );
    return res.data.data;
  },

  updateSenderIdentity: async (
    id: string,
    input: UpdateSenderIdentityInput,
  ): Promise<SenderIdentity> => {
    const res = await apiClient.patch<ApiEnvelope<SenderIdentity>>(
      `/tenant/email-sender-identities/${id}`,
      input,
    );
    return res.data.data;
  },

  archiveSenderIdentity: async (id: string): Promise<void> => {
    await apiClient.delete(`/tenant/email-sender-identities/${id}`);
  },

  // ─── Reputation ────────────────────────────────────────────

  getReputationOverview: async (): Promise<ReputationOverview> => {
    const res = await apiClient.get<ApiEnvelope<ReputationOverview>>(
      "/tenant/email-reputation",
    );
    return res.data.data;
  },

  // ─── Suppressions ──────────────────────────────────────────

  listSuppressions: async (
    params: ListSuppressionsParams = {},
  ): Promise<ListSuppressionsResult> => {
    const res = await apiClient.get<ApiEnvelope<ListSuppressionsResult>>(
      "/tenant/email-suppressions",
      { params },
    );
    return res.data.data;
  },

  removeSuppression: async (id: string): Promise<void> => {
    await apiClient.delete(`/tenant/email-suppressions/${id}`);
  },

  // ─── Messages log ──────────────────────────────────────────

  listMessages: async (
    params: ListMessagesParams = {},
  ): Promise<ListMessagesResult> => {
    const res = await apiClient.get<ApiEnvelope<ListMessagesResult>>(
      "/tenant/email-messages",
      { params },
    );
    return res.data.data;
  },
};

export type SuppressionReason =
  | "HARD_BOUNCE"
  | "COMPLAINT"
  | "MANUAL_UNSUBSCRIBE"
  | "ADMIN_BLOCK"
  | "IMPORTED";

export type EmailCategory = "TRANSACTIONAL" | "NOTIFICATION" | "MARKETING";

export type MessageStatus =
  | "QUEUED"
  | "SENT"
  | "DELIVERED"
  | "BOUNCED"
  | "COMPLAINED"
  | "REJECTED"
  | "FAILED"
  | "SUPPRESSED"
  | "FROZEN";

export interface Suppression {
  id: string;
  tenantId: string;
  email: string;
  reason: SuppressionReason;
  sourceMessageId: string | null;
  categoryScope: EmailCategory | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ListSuppressionsParams {
  page?: number;
  limit?: number;
  search?: string;
  reason?: SuppressionReason;
  /** "ALL" filters to category_scope=NULL; specific category filters to that scope; undefined = all rows. */
  category?: EmailCategory | "ALL";
}

export interface ListSuppressionsResult {
  rows: Suppression[];
  total: number;
  page: number;
  limit: number;
}

export interface MessageLogEntry {
  id: string;
  category: EmailCategory;
  fromAddress: string;
  toAddress: string;
  subject: string;
  templateKey: string | null;
  campaignId: string | null;
  sesMessageId: string | null;
  status: MessageStatus;
  bounceType: string | null;
  bounceSubType: string | null;
  complaintFeedbackType: string | null;
  deliveredAt: string | null;
  bouncedAt: string | null;
  complainedAt: string | null;
  openedAt: string | null;
  clickedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ListMessagesParams {
  page?: number;
  limit?: number;
  search?: string;
  status?: MessageStatus;
  category?: EmailCategory;
  createdAfter?: string;
  createdBefore?: string;
}

export interface ListMessagesResult {
  messages: MessageLogEntry[];
  total: number;
  page: number;
  limit: number;
}
