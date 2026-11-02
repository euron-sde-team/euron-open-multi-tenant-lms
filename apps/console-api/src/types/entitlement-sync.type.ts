/**
 * Plan-level entitlement sync (backfill).
 *
 * Entitlements are SNAPSHOTTED into `entitlements` when a subscription is
 * created, and published plan versions are immutable. So when a new version of
 * a plan adds products, every tenant still sitting on an older version keeps
 * the entitlement set they were provisioned with and never sees the new one.
 *
 * This type set describes an explicit, previewable, idempotent backfill that
 * pushes the products of ONE source version onto every tenant currently
 * subscribed to THAT plan, without moving anyone's subscription or version.
 */

import { EntitlementSource, SubscriptionStatus } from "./tenant.type";

/** What the sync decided to do with one product for one tenant. */
export type EntitlementSyncAction = "CREATE" | "RAISE" | "SKIP";

/** Knobs shared by preview and apply. */
export interface EntitlementSyncOptions {
  /** Version whose products are the template. Defaults to the plan's active version. */
  source_version_id?: string;
  /** Restrict to tenants sitting on these versions of the plan. Default: all versions. */
  version_ids?: string[];
  /** Subscription statuses that count as "live". Default: ACTIVE + TRIALING. */
  statuses?: SubscriptionStatus[];
  /** Restrict to these tenants (the checkbox selection made in the preview). */
  tenant_ids?: string[];
  /**
   * Also grant any application the plan covers that the tenant is missing.
   * An entitlement whose application is not held is inert, so this defaults to true.
   */
  grant_missing_applications?: boolean;
  /**
   * Opt in to ALSO lifting the limit of an entitlement the tenant already holds,
   * where the source version grants more. OFF by default: a normal run is purely
   * additive and never modifies the value of an existing entitlement.
   */
  raise_existing_limits?: boolean;
}

/** Apply additionally demands a reason, like every other entitlement mutation. */
export interface EntitlementSyncApplyRequest extends EntitlementSyncOptions {
  reason: string;
}

/** One product's verdict for one tenant. */
export interface EntitlementSyncChange {
  action: Exclude<EntitlementSyncAction, "SKIP">;
  product_id: string;
  product_code: string;
  feature_key: string;
  application_code: string;
  constraint_type: string;
  unit: string | null;
  /** What the source version grants. */
  source_limit_value: number;
  source_is_unlimited: boolean;
  /** What the tenant holds today. Null on CREATE. */
  current_entitlement_id: string | null;
  current_limit_value: number | null;
  current_is_unlimited: boolean | null;
  /**
   * Source of the row being raised. Surfaced so the operator can see when a
   * raise would touch a hand-made ADMIN grant or a purchased ADDON rather than
   * an ordinary PLAN row.
   */
  current_source: EntitlementSource | null;
  /**
   * Every active row that has to be lifted. Normally one, but a tenant can hold
   * more than one active entitlement for the same product (no unique constraint),
   * and runtime picks one of them arbitrarily, so all of them are raised.
   */
  raise_entitlement_ids: string[];
  /** True when the tenant does not hold the application this product belongs to. */
  application_missing: boolean;
}

/** Everything one tenant would receive from a run. */
export interface EntitlementSyncTenantPlan {
  tenant_id: string;
  tenant_name: string;
  tenant_slug: string;
  tenant_status: string;
  subscription_id: string;
  subscription_status: SubscriptionStatus;
  /** Period end of the live subscription; for TRIALING it is the trial end. */
  subscription_period_end: Date;
  plan_version_id: string;
  plan_version: number;
  creates: EntitlementSyncChange[];
  raises: EntitlementSyncChange[];
  /** Products already satisfied. Left completely untouched. */
  unchanged_count: number;
  /** Applications that would be granted alongside (empty when not needed). */
  applications_to_grant: Array<{ application_id: string; application_code: string }>;
  warnings: string[];
}

/** Per-product roll-up across the whole run: "what am I about to hand out". */
export interface EntitlementSyncProductSummary {
  product_id: string;
  product_code: string;
  feature_key: string;
  application_code: string;
  constraint_type: string;
  unit: string | null;
  limit_value: number;
  is_unlimited: boolean;
  tenants_to_create: number;
  tenants_to_raise: number;
  tenants_unchanged: number;
}

export interface EntitlementSyncPlanRef {
  id: string;
  code: string;
  name: string;
}

export interface EntitlementSyncVersionRef {
  id: string;
  version: number;
  is_active: boolean;
  published_at: Date | null;
  retired_at: Date | null;
}

export interface EntitlementSyncSummary {
  tenants_matched: number;
  tenants_with_changes: number;
  entitlements_to_create: number;
  entitlements_to_raise: number;
  entitlements_unchanged: number;
  applications_to_grant: number;
}

export interface EntitlementSyncPreview {
  plan: EntitlementSyncPlanRef;
  source_version: EntitlementSyncVersionRef;
  options_used: {
    statuses: SubscriptionStatus[];
    version_ids: string[] | null;
    tenant_ids: string[] | null;
    grant_missing_applications: boolean;
    raise_existing_limits: boolean;
  };
  summary: EntitlementSyncSummary;
  products: EntitlementSyncProductSummary[];
  tenants: EntitlementSyncTenantPlan[];
}

export type EntitlementSyncTenantOutcome = "APPLIED" | "NO_CHANGE" | "FAILED";

export interface EntitlementSyncTenantResult {
  tenant_id: string;
  tenant_name: string;
  outcome: EntitlementSyncTenantOutcome;
  entitlements_created: number;
  entitlements_raised: number;
  applications_granted: number;
  created_product_codes: string[];
  raised_product_codes: string[];
  error?: string;
}

export interface EntitlementSyncResult {
  plan: EntitlementSyncPlanRef;
  source_version: EntitlementSyncVersionRef;
  summary: {
    tenants_processed: number;
    tenants_changed: number;
    tenants_failed: number;
    entitlements_created: number;
    entitlements_raised: number;
    applications_granted: number;
  };
  tenants: EntitlementSyncTenantResult[];
}
