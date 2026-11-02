/**
 * Admin Audit Log Types
 * DB-backed trail of every core-admin action (admin user/role changes, logins,
 * tenant/subscription/entitlement operations, catalog edits, etc.)
 */

import { PaginatedResponse, PaginationParams } from "./tenant.type";

/**
 * Acting admin context, assembled by the controller from the request and
 * threaded into the service layer so mutations can be attributed.
 */
export interface AuditActor {
  adminId: string | null;
  email: string | null;
  name: string | null;
  ipAddress: string | null;
  userAgent: string | null;
}

/** Coarse grouping for an audit entry. */
export type AuditCategory =
  | "ADMIN_USER"
  | "ADMIN_ROLE"
  | "ADMIN_PERMISSION"
  | "AUTH"
  | "TENANT"
  | "SUBSCRIPTION"
  | "ADDON"
  | "APPLICATION"
  | "ENTITLEMENT"
  | "PLAN"
  | "PRODUCT"
  | "FEATURE"
  | "BILLING_PROVIDER";

/** Payload passed to auditService.record() at the end of a successful mutation. */
export interface RecordAuditInput {
  actor: AuditActor;
  /** Machine code, e.g. TENANT_SUSPENDED, SUBSCRIPTION_ASSIGNED, LOGIN */
  action: string;
  // Widened: typed categories keep autocomplete; the auto-audit middleware may
  // derive others from the request path.
  category: AuditCategory | (string & {});
  resourceId?: string | null;
  /** Human-readable name/slug/email of the resource (never a raw ULID) */
  resourceLabel?: string | null;
  tenantId?: string | null;
  /** Pre-rendered human sentence describing what happened */
  summary: string;
  metadata?: Record<string, unknown> | null;
  isSystem?: boolean;
  /** Device + geo enrichment (parsed from UA / IP) for the actor. */
  device?: string | null;
  browser?: string | null;
  os?: string | null;
  country?: string | null;
  region?: string | null;
  city?: string | null;
}

/** A single audit log row as returned by the read API. */
export interface AuditLogEntry {
  id: string;
  actor_admin_id: string | null;
  actor_email: string | null;
  actor_name: string | null;
  action: string;
  category: string;
  resource_id: string | null;
  resource_label: string | null;
  tenant_id: string | null;
  summary: string;
  metadata: Record<string, unknown> | null;
  ip_address: string | null;
  user_agent: string | null;
  is_system: boolean;
  device: string | null;
  browser: string | null;
  os: string | null;
  country: string | null;
  region: string | null;
  city: string | null;
  created_at: Date;
}

export interface AuditLogQueryParams extends PaginationParams {
  /** Filter by acting admin id */
  actor?: string;
  category?: string;
  action?: string;
  tenant_id?: string;
  /** ISO date range on created_at */
  from?: string;
  to?: string;
  /** ILIKE across summary, actor_email, resource_label */
  search?: string;
}

export type AuditLogListResponse = PaginatedResponse<AuditLogEntry>;
