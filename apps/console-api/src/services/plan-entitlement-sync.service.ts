import { sql } from "kysely";
import { ulid } from "ulid";
import { db } from "../db/connection";
import { BadRequestError } from "../errors/bad-request.error";
import { NotFoundError } from "../errors/not-found.error";
import entitlementRepository, {
  Entitlement,
} from "../repositories/entitlement.repository";
import planRepository from "../repositories/plan.repository";
import subscriptionRepository, {
  PlanSubscriber,
} from "../repositories/subscription.repository";
import { AuditActor } from "../types/audit-log.type";
import {
  EntitlementSyncApplyRequest,
  EntitlementSyncChange,
  EntitlementSyncOptions,
  EntitlementSyncPlanRef,
  EntitlementSyncPreview,
  EntitlementSyncProductSummary,
  EntitlementSyncResult,
  EntitlementSyncTenantPlan,
  EntitlementSyncTenantResult,
  EntitlementSyncVersionRef,
} from "../types/entitlement-sync.type";
import { SubscriptionStatus } from "../types/tenant.type";
import auditService from "./audit.service";
import logger from "../utils/logger";

/**
 * Products of a plan version, shaped by subscriptionRepository.getPlanVersionProducts.
 * Re-declared locally because the repository does not export the interface.
 */
type SourceProduct = Awaited<
  ReturnType<typeof subscriptionRepository.getPlanVersionProducts>
>[number];

/** Statuses that count as a live subscription when none are supplied. */
const DEFAULT_STATUSES: SubscriptionStatus[] = ["ACTIVE", "TRIALING"];

/**
 * Accepted values for the `statuses` option. Deliberately NOT the full enum:
 * syncing a CANCELLED/EXPIRED/PENDING subscription would hand live entitlements
 * (and reactivated applications) to tenants whose cancellation cleanup already
 * ran, silently restoring access for non-paying tenants. PAST_DUE stays allowed
 * because dunning tenants are still in their grace period.
 */
const ALLOWED_SYNC_STATUSES: SubscriptionStatus[] = [
  "ACTIVE",
  "TRIALING",
  "PAST_DUE",
];

/**
 * Ceiling on how many tenants one apply call may touch. Each tenant is its own
 * transaction, so this is not a correctness limit, it exists so a mis-aimed run
 * on the platform's largest plan cannot fire thousands of grants from a single
 * click without the operator narrowing it first.
 */
const MAX_SYNC_TENANTS = 500;

const MIN_REASON_LENGTH = 10;

/** Tenants written in parallel during apply. Each still gets its own transaction. */
const APPLY_CONCURRENCY = 5;

/**
 * Plan-level entitlement sync.
 *
 * Pushes the products of one published plan version onto every tenant currently
 * subscribed to that plan, on any version, without moving anyone's subscription.
 *
 * The run is:
 *  - plan scoped, the subscriber query filters on plan_versions.plan_id
 *  - additive, by default it ONLY creates entitlements the tenant is missing.
 *                    The value of an existing entitlement is never modified unless
 *                    the caller opts in with raise_existing_limits, and even then a
 *                    limit can only move up, never down
 *  - idempotent, a second run finds everything satisfied and changes nothing
 *  - previewable, preview() and apply() run the same diff
 *  - per tenant, one transaction each, so one bad tenant cannot roll back the rest
 */
class PlanEntitlementSyncService {
  // ============================================
  // PUBLIC API
  // ============================================

  /**
   * Dry run. Computes exactly what apply() would do and changes nothing.
   */
  async preview(
    planId: string,
    rawOptions: EntitlementSyncOptions = {}
  ): Promise<EntitlementSyncPreview> {
    const options = this.validateOptions(rawOptions);

    const { plan, version, sourceProducts } = await this.resolveSource(
      planId,
      options.source_version_id
    );

    const statuses = options.statuses?.length ? options.statuses : DEFAULT_STATUSES;
    const grantMissingApplications = options.grant_missing_applications !== false;
    const raiseExistingLimits = options.raise_existing_limits === true;

    const { tenantPlans } = await this.buildTenantPlans(
      plan,
      version.id,
      sourceProducts,
      {
        ...options,
        statuses,
        grant_missing_applications: grantMissingApplications,
        raise_existing_limits: raiseExistingLimits,
      }
    );

    return {
      plan,
      source_version: version,
      options_used: {
        statuses,
        version_ids: options.version_ids?.length ? options.version_ids : null,
        tenant_ids: options.tenant_ids?.length ? options.tenant_ids : null,
        grant_missing_applications: grantMissingApplications,
        raise_existing_limits: raiseExistingLimits,
      },
      summary: this.summarise(tenantPlans),
      products: this.rollUpProducts(sourceProducts, tenantPlans),
      tenants: tenantPlans,
    };
  }

  /**
   * Execute the sync. Re-runs the diff server side (the preview is advisory,
   * never trusted as input) and then writes one transaction per tenant.
   */
  async apply(
    planId: string,
    rawData: EntitlementSyncApplyRequest,
    actor: AuditActor
  ): Promise<EntitlementSyncResult> {
    if (
      typeof rawData.reason !== "string" ||
      rawData.reason.trim().length < MIN_REASON_LENGTH
    ) {
      throw new BadRequestError(
        `Reason is required (minimum ${MIN_REASON_LENGTH} characters)`
      );
    }
    const reason = rawData.reason.trim();
    const data = { ...this.validateOptions(rawData), reason };

    const { plan, version, sourceProducts } = await this.resolveSource(
      planId,
      data.source_version_id
    );

    const statuses = data.statuses?.length ? data.statuses : DEFAULT_STATUSES;
    const grantMissingApplications = data.grant_missing_applications !== false;
    const raiseExistingLimits = data.raise_existing_limits === true;

    const { tenantPlans } = await this.buildTenantPlans(
      plan,
      version.id,
      sourceProducts,
      {
        ...data,
        statuses,
        grant_missing_applications: grantMissingApplications,
        raise_existing_limits: raiseExistingLimits,
      }
    );

    // Cap on tenants that would actually be written to. Matched-but-unchanged
    // tenants cost nothing (applyForTenant returns before opening a transaction),
    // so a 600-subscriber plan where 30 tenants need the new product still works.
    const changedCount = tenantPlans.filter(
      (t) =>
        t.creates.length > 0 ||
        t.raises.length > 0 ||
        t.applications_to_grant.length > 0
    ).length;
    if (changedCount > MAX_SYNC_TENANTS) {
      throw new BadRequestError(
        `This run would change ${changedCount} tenants, above the ${MAX_SYNC_TENANTS} limit for a single apply. ` +
          `Narrow it down with version_ids or tenant_ids and run it in batches.`
      );
    }

    // Bounded concurrency: each tenant keeps its own transaction and advisory
    // lock, but five run in flight so a large plan finishes inside the client's
    // request timeout instead of serialising hundreds of round trips.
    const results: EntitlementSyncTenantResult[] = new Array(tenantPlans.length);
    let cursor = 0;
    await Promise.all(
      Array.from(
        { length: Math.min(APPLY_CONCURRENCY, tenantPlans.length) },
        async () => {
          for (;;) {
            const index = cursor++;
            if (index >= tenantPlans.length) return;
            results[index] = await this.applyForTenant(
              tenantPlans[index] as EntitlementSyncTenantPlan,
              version.id,
              reason,
              actor,
              raiseExistingLimits
            );
          }
        }
      )
    );

    const result: EntitlementSyncResult = {
      plan,
      source_version: version,
      summary: {
        tenants_processed: results.length,
        tenants_changed: results.filter((r) => r.outcome === "APPLIED").length,
        tenants_failed: results.filter((r) => r.outcome === "FAILED").length,
        entitlements_created: results.reduce((n, r) => n + r.entitlements_created, 0),
        entitlements_raised: results.reduce((n, r) => n + r.entitlements_raised, 0),
        applications_granted: results.reduce((n, r) => n + r.applications_granted, 0),
      },
      tenants: results,
    };

    logger.info(
      `[entitlement-sync] Plan '${plan.code}' from v${version.version}: ` +
        `${result.summary.tenants_changed}/${result.summary.tenants_processed} tenants changed, ` +
        `${result.summary.entitlements_created} created, ${result.summary.entitlements_raised} raised, ` +
        `${result.summary.applications_granted} applications granted, ` +
        `${result.summary.tenants_failed} failed.`
    );

    this.recordAudit(plan, version, result, reason, actor);

    return result;
  }

  // ============================================
  // INPUT VALIDATION
  // ============================================

  /**
   * The request body reaches the controller untyped, so a caller can send
   * `statuses: "ACTIVE"` or `tenant_ids: "abc"`. Kysely would then build an
   * `in` clause against a bare string and fail with an opaque 500, or a Set of
   * single characters would silently match no tenant at all. Normalise here so
   * both entry points reject bad input with a clear 400 instead.
   */
  private validateOptions(options: EntitlementSyncOptions): EntitlementSyncOptions {
    const stringArray = (
      value: unknown,
      field: string
    ): string[] | undefined => {
      if (value === undefined || value === null) return undefined;
      if (!Array.isArray(value) || value.some((v) => typeof v !== "string")) {
        throw new BadRequestError(`'${field}' must be an array of ids`);
      }
      // An explicit empty array must NOT quietly mean "no filter": a caller that
      // filtered its selection down to zero would otherwise mass-apply to every
      // subscriber of the plan. Omit the field to mean "no filter".
      if (value.length === 0) {
        throw new BadRequestError(
          `'${field}' is an empty array, which would select nothing. Omit the field to mean "all".`
        );
      }
      return value as string[];
    };

    if (
      options.source_version_id !== undefined &&
      typeof options.source_version_id !== "string"
    ) {
      throw new BadRequestError("'source_version_id' must be a string");
    }

    if (
      options.grant_missing_applications !== undefined &&
      typeof options.grant_missing_applications !== "boolean"
    ) {
      throw new BadRequestError("'grant_missing_applications' must be a boolean");
    }

    if (
      options.raise_existing_limits !== undefined &&
      typeof options.raise_existing_limits !== "boolean"
    ) {
      throw new BadRequestError("'raise_existing_limits' must be a boolean");
    }

    let statuses: SubscriptionStatus[] | undefined;
    if (options.statuses !== undefined && options.statuses !== null) {
      if (!Array.isArray(options.statuses)) {
        throw new BadRequestError("'statuses' must be an array of subscription statuses");
      }
      if (options.statuses.length === 0) {
        throw new BadRequestError(
          "'statuses' is an empty array. Omit the field to use the defaults (ACTIVE, TRIALING)."
        );
      }
      const invalid = options.statuses.filter(
        (status) => !ALLOWED_SYNC_STATUSES.includes(status)
      );
      if (invalid.length > 0) {
        throw new BadRequestError(
          `Invalid subscription status for a sync: ${invalid.join(", ")}. ` +
            `Allowed: ${ALLOWED_SYNC_STATUSES.join(", ")}. Cancelled or expired ` +
            `subscriptions cannot be synced, that would restore access for churned tenants.`
        );
      }
      statuses = options.statuses;
    }

    return {
      source_version_id: options.source_version_id,
      version_ids: stringArray(options.version_ids, "version_ids"),
      tenant_ids: stringArray(options.tenant_ids, "tenant_ids"),
      statuses,
      grant_missing_applications: options.grant_missing_applications,
      raise_existing_limits: options.raise_existing_limits,
    };
  }

  // ============================================
  // POLICY
  // ============================================

  /**
   * The whole behavioural contract of the feature lives here.
   *
   * Given what the source version grants and what the tenant holds today,
   * decide whether to create the entitlement, raise its limit, or leave it be.
   *
   * DEFAULT IS PURELY ADDITIVE: with `allowRaise` false, a product the tenant
   * already holds is always SKIPped, whatever its limit, so an existing
   * entitlement's value is never modified by an ordinary run.
   *
   * With `allowRaise` on, a limit can still only move UP. That is why raising is
   * safe to apply to a row of any source: a purchased ADDON or a hand-made ADMIN
   * grant is only touched when the plan would give the tenant strictly more than
   * it has, and the preview flags those rows so a raise is never silent.
   */
  private resolveProductAction(
    source: { limit_value: number; is_unlimited: boolean },
    existing: Entitlement | undefined,
    allowRaise: boolean
  ): "CREATE" | "RAISE" | "SKIP" {
    if (!existing) return "CREATE";
    if (!allowRaise) return "SKIP";
    // Already unlimited. Nothing can be an upgrade, and a finite source would be a downgrade.
    if (existing.is_unlimited) return "SKIP";
    if (source.is_unlimited) return "RAISE";
    return source.limit_value > existing.limit_value ? "RAISE" : "SKIP";
  }

  // ============================================
  // DIFF
  // ============================================

  /**
   * Load the plan, pick the source version, and validate it can be synced from.
   */
  private async resolveSource(
    planId: string,
    sourceVersionId?: string
  ): Promise<{
    plan: EntitlementSyncPlanRef;
    version: EntitlementSyncVersionRef;
    sourceProducts: SourceProduct[];
  }> {
    const plan = await planRepository.findById(planId);
    if (!plan) {
      throw new NotFoundError(`Plan with ID '${planId}' not found`);
    }

    const version = sourceVersionId
      ? await planRepository.findVersionById(sourceVersionId)
      : await planRepository.findActiveVersion(planId);

    if (!version) {
      throw new NotFoundError(
        sourceVersionId
          ? `Plan version '${sourceVersionId}' not found`
          : `Plan '${plan.code}' has no published version to sync from. Publish one first, or pass source_version_id.`
      );
    }

    if (version.plan_id !== planId) {
      throw new BadRequestError(
        `Plan version '${version.id}' does not belong to plan '${plan.code}'`
      );
    }

    // A draft has never been released to anyone. Syncing from it would hand out
    // entitlements that no tenant ever bought and that no version guarantees.
    // Retired versions stay allowed, since offer cycling retires perfectly real versions.
    if (!version.published_at) {
      throw new BadRequestError(
        `Version ${version.version} of plan '${plan.code}' is still a draft. Only published versions can be synced to tenants.`
      );
    }

    const sourceProducts = await subscriptionRepository.getPlanVersionProducts(version.id);
    if (sourceProducts.length === 0) {
      throw new BadRequestError(
        `Version ${version.version} of plan '${plan.code}' has no products, so there is nothing to sync.`
      );
    }

    return {
      plan: { id: plan.id, code: plan.code, name: plan.name },
      version: {
        id: version.id,
        version: version.version,
        is_active: version.is_active,
        published_at: version.published_at,
        retired_at: version.retired_at,
      },
      sourceProducts,
    };
  }

  /**
   * Compute the per-tenant change set. Three bulk queries total, regardless of
   * how many tenants match, then the whole diff runs in memory.
   */
  private async buildTenantPlans(
    plan: EntitlementSyncPlanRef,
    sourceVersionId: string,
    sourceProducts: SourceProduct[],
    options: EntitlementSyncOptions & { statuses: SubscriptionStatus[] }
  ): Promise<{ tenantPlans: EntitlementSyncTenantPlan[] }> {
    const raiseExistingLimits = options.raise_existing_limits === true;
    let subscribers = await subscriptionRepository.findSubscribersByPlan(plan.id, {
      statuses: options.statuses,
      versionIds: options.version_ids,
    });

    if (options.tenant_ids?.length) {
      const wanted = new Set(options.tenant_ids);
      subscribers = subscribers.filter((s) => wanted.has(s.tenant_id));
    }

    // A tenant holds at most one live subscription, but guard anyway so a dirty
    // row can never make us process the same tenant twice in one run.
    const seen = new Set<string>();
    subscribers = subscribers.filter((s) => {
      if (seen.has(s.tenant_id)) return false;
      seen.add(s.tenant_id);
      return true;
    });

    if (subscribers.length === 0) {
      return { tenantPlans: [] };
    }

    const tenantIds = subscribers.map((s) => s.tenant_id);
    const [
      entitlementsByTenant,
      applicationStatusesByTenant,
      usageByTenant,
      planApplications,
    ] = await Promise.all([
      entitlementRepository.findActiveByTenantIds(tenantIds),
      entitlementRepository.findApplicationStatusesByTenantIds(tenantIds),
      entitlementRepository.findMaxUsageByTenantIds(tenantIds),
      subscriptionRepository.getPlanApplications(plan.id),
    ]);

    const grantMissingApplications = options.grant_missing_applications !== false;

    const tenantPlans = subscribers.map((subscriber) =>
      this.buildTenantPlan(
        subscriber,
        sourceProducts,
        entitlementsByTenant.get(subscriber.tenant_id) ?? [],
        applicationStatusesByTenant.get(subscriber.tenant_id) ?? new Map<string, string>(),
        usageByTenant.get(subscriber.tenant_id) ?? new Map<string, number>(),
        planApplications,
        grantMissingApplications,
        raiseExistingLimits
      )
    );

    return { tenantPlans };
  }

  /** Diff one tenant against the source version. */
  private buildTenantPlan(
    subscriber: PlanSubscriber,
    sourceProducts: SourceProduct[],
    currentEntitlements: Entitlement[],
    applicationStatuses: Map<string, string>,
    maxUsageByProduct: Map<string, number>,
    planApplications: Array<{ application_id: string; application_code: string }>,
    grantMissingApplications: boolean,
    raiseExistingLimits: boolean
  ): EntitlementSyncTenantPlan {
    // An entitlement is effective only while its application is ACTIVE/TRIALING.
    const liveApplicationIds = new Set(
      [...applicationStatuses.entries()]
        .filter(([, status]) => status === "ACTIVE" || status === "TRIALING")
        .map(([id]) => id)
    );
    const byProductCode = this.groupByProductCode(currentEntitlements);

    const creates: EntitlementSyncChange[] = [];
    const raises: EntitlementSyncChange[] = [];
    const duplicatedProductCodes: string[] = [];
    let unchanged = 0;

    for (const source of sourceProducts) {
      const rows = byProductCode.get(source.product_code) ?? [];
      if (rows.length > 1) duplicatedProductCodes.push(source.product_code);

      // Every row that is individually below the source has to move. See
      // groupByProductCode for why a product can have more than one row.
      const toRaise = rows.filter(
        (row) =>
          this.resolveProductAction(source, row, raiseExistingLimits) === "RAISE"
      );
      const action =
        rows.length === 0 ? "CREATE" : toRaise.length > 0 ? "RAISE" : "SKIP";

      if (action === "SKIP") {
        unchanged++;
        continue;
      }

      // Show the weakest row: it is the limit the tenant is at risk of being held to.
      const weakest = this.weakestRow(rows);

      const change: EntitlementSyncChange = {
        action,
        product_id: source.product_id,
        product_code: source.product_code,
        feature_key: source.feature_key,
        application_code: source.application_code,
        constraint_type: source.product_constraint_type,
        unit: source.product_unit,
        source_limit_value: source.limit_value,
        source_is_unlimited: source.is_unlimited,
        current_entitlement_id: weakest?.id ?? null,
        current_limit_value: weakest?.limit_value ?? null,
        current_is_unlimited: weakest?.is_unlimited ?? null,
        current_source: weakest?.source ?? null,
        raise_entitlement_ids: toRaise.map((row) => row.id),
        application_missing: !liveApplicationIds.has(source.application_id),
      };

      if (action === "CREATE") creates.push(change);
      else raises.push(change);
    }

    // Only applications actually needed by something we are about to write.
    const neededApplicationIds = new Set(
      [...creates, ...raises]
        .filter((c) => c.application_missing)
        .map(
          (c) =>
            sourceProducts.find((p) => p.product_code === c.product_code)!
              .application_id
        )
    );

    // Grantable: the tenant has no row at all, or a CANCELLED one (reactivating a
    // cancelled app for a live subscriber is what a plan assignment would do).
    // SUSPENDED is a deliberate operator action, never undone by a bulk sync.
    const suspendedNeeded = planApplications.filter(
      (app) =>
        neededApplicationIds.has(app.application_id) &&
        applicationStatuses.get(app.application_id) === "SUSPENDED"
    );
    const applicationsToGrant = grantMissingApplications
      ? planApplications.filter((app) => {
          if (!neededApplicationIds.has(app.application_id)) return false;
          const status = applicationStatuses.get(app.application_id);
          return status === undefined || status === "CANCELLED";
        })
      : [];

    const warnings: string[] = [];

    if (suspendedNeeded.length > 0) {
      warnings.push(
        `Application ${suspendedNeeded.map((a) => a.application_code).join(", ")} is SUSPENDED for this ` +
          `tenant. The sync will not reactivate it, so entitlements under it stay inert until an ` +
          `operator lifts the suspension.`
      );
    }

    if (!grantMissingApplications && neededApplicationIds.size > 0) {
      const codes = [...new Set([...creates, ...raises]
        .filter((c) => c.application_missing)
        .map((c) => c.application_code))];
      warnings.push(
        `Tenant does not hold ${codes.join(", ")}. Those entitlements will be inert until the application is granted.`
      );
    }

    // An application the plan does not cover cannot be granted from here.
    const uncoverable = new Set(
      [...neededApplicationIds].filter(
        (id) => !planApplications.some((app) => app.application_id === id)
      )
    );
    if (grantMissingApplications && uncoverable.size > 0) {
      const codes = [
        ...new Set(
          sourceProducts
            .filter((p) => uncoverable.has(p.application_id))
            .map((p) => p.application_code)
        ),
      ];
      warnings.push(
        `Application ${codes.join(", ")} is not linked to this plan, so it cannot be granted automatically. ` +
          `Link it to the plan, or grant it on the tenant, for those entitlements to take effect.`
      );
    }

    // A grant below what the tenant already consumed puts them instantly over
    // limit (the plan-assignment path blocks this behind `force`). The sync is
    // additive so it still grants, but never silently.
    const overLimit = creates.filter((c) => {
      if (c.source_is_unlimited) return false;
      const used = maxUsageByProduct.get(c.product_code) ?? 0;
      return used > c.source_limit_value;
    });
    if (overLimit.length > 0) {
      warnings.push(
        `Usage already exceeds the granted limit for ${overLimit
          .map(
            (c) =>
              `${c.product_code} (used ${maxUsageByProduct.get(c.product_code)}, limit ${c.source_limit_value})`
          )
          .join(", ")}. The tenant will be over limit immediately; consider an override after the sync.`
      );
    }

    if (subscriber.tenant_status !== "ACTIVE") {
      warnings.push(`Tenant is ${subscriber.tenant_status}.`);
    }

    if (duplicatedProductCodes.length > 0) {
      warnings.push(
        `Tenant holds more than one active entitlement for ${duplicatedProductCodes.join(", ")}. ` +
          (raiseExistingLimits
            ? `Every copy below the new limit is raised, so runtime reads the intended value whichever row it picks.`
            : `This run does not modify them (raising is off); runtime may read either copy.`)
      );
    }

    const nonPlanRaises = raises.filter(
      (r) => r.current_source && r.current_source !== "PLAN"
    );
    if (nonPlanRaises.length > 0) {
      warnings.push(
        `Raising ${nonPlanRaises
          .map((r) => `${r.product_code} (${r.current_source})`)
          .join(", ")} which was not granted by a plan.`
      );
    }

    return {
      tenant_id: subscriber.tenant_id,
      tenant_name: subscriber.tenant_name,
      tenant_slug: subscriber.tenant_slug,
      tenant_status: subscriber.tenant_status,
      subscription_id: subscriber.subscription_id,
      subscription_status: subscriber.subscription_status,
      subscription_period_end: subscriber.current_period_end,
      plan_version_id: subscriber.plan_version_id,
      plan_version: subscriber.plan_version,
      creates,
      raises,
      unchanged_count: unchanged,
      applications_to_grant: applicationsToGrant,
      warnings,
    };
  }

  // ============================================
  // WRITE
  // ============================================

  /**
   * Apply one tenant's change set in a single transaction.
   *
   * The diff was computed outside the transaction, so everything is re-checked
   * inside it against a fresh read taken AFTER an advisory lock on the tenant.
   * The same lock is taken by assignPlanToTenant/upgradeSubscription, so a sync
   * can never interleave with a plan change on the same tenant: whichever wins
   * the lock commits first, and the loser re-reads the committed state. The
   * subscription is also re-verified as still live before anything is written.
   */
  private async applyForTenant(
    tenantPlan: EntitlementSyncTenantPlan,
    sourceVersionId: string,
    reason: string,
    actor: AuditActor,
    raiseExistingLimits: boolean
  ): Promise<EntitlementSyncTenantResult> {
    const base: EntitlementSyncTenantResult = {
      tenant_id: tenantPlan.tenant_id,
      tenant_name: tenantPlan.tenant_name,
      outcome: "NO_CHANGE",
      entitlements_created: 0,
      entitlements_raised: 0,
      applications_granted: 0,
      created_product_codes: [],
      raised_product_codes: [],
    };

    if (
      tenantPlan.creates.length === 0 &&
      tenantPlan.raises.length === 0 &&
      tenantPlan.applications_to_grant.length === 0
    ) {
      return base;
    }

    try {
      const applied = await db.transaction().execute(async (trx) => {
        const now = new Date();
        const outcome = { created: [] as string[], raised: [] as string[], apps: 0 };

        // Serialise every entitlement writer for this tenant. `entitlements` has
        // no unique constraint on (tenant_id, product_code), so a sync racing
        // another sync OR a plan assignment (billing webhook) would both read
        // "no row" under READ COMMITTED and both insert, producing exactly the
        // duplicate rows that already exist in the data. assignPlanToTenant and
        // upgradeSubscription take the SAME key; keep them in step. The lock is
        // transaction scoped and released on commit.
        await sql`SELECT pg_advisory_xact_lock(hashtext(${
          `tenant-entitlements:${tenantPlan.tenant_id}`
        }))`.execute(trx);

        // With the lock held, confirm the subscription this diff was computed
        // against is still live. A plan change that won the lock first cancels
        // it; writing rows bound to a dead subscription would leave grants that
        // no future archiveAllPlanEntitlements pass can attribute correctly.
        const liveSubscription = await trx
          .selectFrom("subscriptions")
          .select(["status"])
          .where("id", "=", tenantPlan.subscription_id)
          .executeTakeFirst();
        if (
          !liveSubscription ||
          !["ACTIVE", "TRIALING", "PAST_DUE"].includes(liveSubscription.status)
        ) {
          throw new Error(
            `Subscription '${tenantPlan.subscription_id}' is no longer live ` +
              `(${liveSubscription?.status ?? "missing"}); the tenant's plan changed ` +
              `while the sync was running. Re-run the preview.`
          );
        }

        // Fresh read inside the transaction: the source of truth for what exists.
        const currentRows =
          (
            await entitlementRepository.findActiveByTenantIds([tenantPlan.tenant_id], trx)
          ).get(tenantPlan.tenant_id) ?? [];
        const currentByCode = this.groupByProductCode(currentRows);
        const currentById = new Map(currentRows.map((row) => [row.id, row]));

        // 1. Applications first, so an entitlement written below is live
        //    immediately. Mirrors assignPlanToTenant: a TRIALING subscriber gets
        //    a TRIALING app carrying the trial end (the subscription period end,
        //    which IS the trial end for trials), not a permanent-looking ACTIVE
        //    row. SUSPENDED rows are never reactivated, that is an operator hold.
        const isTrial = tenantPlan.subscription_status === "TRIALING";
        const appStatus = isTrial ? ("TRIALING" as const) : ("ACTIVE" as const);
        const trialEndsAt = isTrial ? tenantPlan.subscription_period_end : null;

        for (const app of tenantPlan.applications_to_grant) {
          const existingApp = await subscriptionRepository.findTenantApplication(
            tenantPlan.tenant_id,
            app.application_id,
            trx
          );

          if (!existingApp) {
            await subscriptionRepository.createTenantApplication(
              {
                id: ulid(),
                tenant_id: tenantPlan.tenant_id,
                application_id: app.application_id,
                status: appStatus,
                source: "SUBSCRIPTION",
                source_subscription_id: tenantPlan.subscription_id,
                trial_ends_at: trialEndsAt,
                created_at: now,
                updated_at: now,
              },
              trx
            );
            outcome.apps++;
          } else if (existingApp.status === "CANCELLED") {
            await subscriptionRepository.reactivateTenantApplication(
              existingApp.id,
              {
                status: appStatus,
                source: "SUBSCRIPTION",
                source_subscription_id: tenantPlan.subscription_id,
                trial_ends_at: trialEndsAt,
              },
              trx
            );
            outcome.apps++;
          }
          // else: already live (nothing to do) or SUSPENDED (left alone).
        }

        // 2. Creates. Written exactly like assignPlanToTenant writes them, so the
        //    row is indistinguishable from one provisioned by a plan assignment
        //    and is archived correctly by archiveAllPlanEntitlements on the next
        //    plan change. source_plan_version_id records the version it came from.
        for (const change of tenantPlan.creates) {
          if (currentByCode.has(change.product_code)) continue; // appeared since the diff

          await entitlementRepository.create(
            {
              id: ulid(),
              tenant_id: tenantPlan.tenant_id,
              product_id: change.product_id,
              application_code: change.application_code,
              feature_key: change.feature_key,
              product_code: change.product_code,
              is_unlimited: change.source_is_unlimited,
              limit_value: change.source_limit_value,
              used_value: 0,
              source: "PLAN",
              source_subscription_id: tenantPlan.subscription_id,
              source_plan_version_id: sourceVersionId,
              source_addon_id: null,
              is_active: true,
              created_at: now,
              updated_at: now,
            },
            trx
          );
          outcome.created.push(change.product_code);
        }

        // 3. Raises. Only limit_value / is_unlimited move. used_value, source and
        //    the usage counters are never touched, so consumption is preserved.
        for (const change of tenantPlan.raises) {
          let raisedAny = false;

          for (const entitlementId of change.raise_entitlement_ids) {
            const current = currentById.get(entitlementId);
            if (!current) continue; // archived since the diff, leave it alone

            // Re-run the policy against the fresh row so a concurrent override
            // that already raised it higher is never walked back.
            const action = this.resolveProductAction(
              {
                limit_value: change.source_limit_value,
                is_unlimited: change.source_is_unlimited,
              },
              current,
              raiseExistingLimits
            );
            if (action !== "RAISE") continue;

            await entitlementRepository.update(
              current.id,
              {
                limit_value: change.source_is_unlimited ? 0 : change.source_limit_value,
                is_unlimited: change.source_is_unlimited,
                updated_at: now,
              },
              trx
            );

            // Audit trail in the same place a manual override lands, so the
            // per-entitlement history panel shows it with no extra plumbing.
            await entitlementRepository.createOverride(
              {
                id: ulid(),
                entitlement_id: current.id,
                old_limit_value: current.limit_value,
                new_limit_value: change.source_is_unlimited
                  ? 0
                  : change.source_limit_value,
                // entitlement_overrides has no is_unlimited column, so a raise to
                // unlimited would otherwise read as "10 -> 0", i.e. a downgrade.
                // Say so in the reason, which is what the history UI renders.
                reason: change.source_is_unlimited
                  ? `PLAN SYNC (raised to unlimited): ${reason}`
                  : `PLAN SYNC: ${reason}`,
                admin_id: actor.adminId ?? "SYSTEM",
                created_at: now,
              },
              trx
            );
            raisedAny = true;
          }

          if (raisedAny) outcome.raised.push(change.product_code);
        }

        return outcome;
      });

      const changed =
        applied.created.length > 0 || applied.raised.length > 0 || applied.apps > 0;

      return {
        ...base,
        outcome: changed ? "APPLIED" : "NO_CHANGE",
        entitlements_created: applied.created.length,
        entitlements_raised: applied.raised.length,
        applications_granted: applied.apps,
        created_product_codes: applied.created,
        raised_product_codes: applied.raised,
      };
    } catch (err) {
      const message = (err as Error).message;
      logger.error(
        `[entitlement-sync] Tenant '${tenantPlan.tenant_id}' (${tenantPlan.tenant_name}) failed: ${message}`
      );
      return { ...base, outcome: "FAILED", error: message };
    }
  }

  // ============================================
  // PRIVATE HELPERS
  // ============================================

  /**
   * Group a tenant's active entitlements by product code.
   *
   * There is no unique constraint on (tenant_id, product_code), and real data
   * has pairs: an ADMIN grant made by hand plus a PLAN row materialised later
   * by a provisioning path that did not check for the ADMIN row first. Runtime
   * lookups use executeTakeFirst with no ORDER BY, so which copy is authoritative
   * is not knowable. The sync therefore treats every copy as authoritative and
   * lifts all of them, rather than guessing.
   */
  private groupByProductCode(
    entitlements: Entitlement[]
  ): Map<string, Entitlement[]> {
    const grouped = new Map<string, Entitlement[]>();
    for (const entitlement of entitlements) {
      const existing = grouped.get(entitlement.product_code);
      if (existing) existing.push(entitlement);
      else grouped.set(entitlement.product_code, [entitlement]);
    }
    return grouped;
  }

  /** The row with the least generous limit, which is the tenant's worst case. */
  private weakestRow(rows: Entitlement[]): Entitlement | undefined {
    return rows.reduce<Entitlement | undefined>((weakest, row) => {
      if (!weakest) return row;
      if (weakest.is_unlimited && !row.is_unlimited) return row;
      if (!weakest.is_unlimited && row.is_unlimited) return weakest;
      return row.limit_value < weakest.limit_value ? row : weakest;
    }, undefined);
  }

  private summarise(tenantPlans: EntitlementSyncTenantPlan[]) {
    return {
      tenants_matched: tenantPlans.length,
      tenants_with_changes: tenantPlans.filter(
        (t) => t.creates.length > 0 || t.raises.length > 0
      ).length,
      entitlements_to_create: tenantPlans.reduce((n, t) => n + t.creates.length, 0),
      entitlements_to_raise: tenantPlans.reduce((n, t) => n + t.raises.length, 0),
      entitlements_unchanged: tenantPlans.reduce((n, t) => n + t.unchanged_count, 0),
      applications_to_grant: tenantPlans.reduce(
        (n, t) => n + t.applications_to_grant.length,
        0
      ),
    };
  }

  /** "What am I about to hand out, and to how many tenants." */
  private rollUpProducts(
    sourceProducts: SourceProduct[],
    tenantPlans: EntitlementSyncTenantPlan[]
  ): EntitlementSyncProductSummary[] {
    return sourceProducts.map((product) => {
      let toCreate = 0;
      let toRaise = 0;

      for (const tenantPlan of tenantPlans) {
        if (tenantPlan.creates.some((c) => c.product_code === product.product_code)) {
          toCreate++;
        } else if (
          tenantPlan.raises.some((r) => r.product_code === product.product_code)
        ) {
          toRaise++;
        }
      }

      return {
        product_id: product.product_id,
        product_code: product.product_code,
        feature_key: product.feature_key,
        application_code: product.application_code,
        constraint_type: product.product_constraint_type,
        unit: product.product_unit,
        limit_value: product.limit_value,
        is_unlimited: product.is_unlimited,
        tenants_to_create: toCreate,
        tenants_to_raise: toRaise,
        tenants_unchanged: tenantPlans.length - toCreate - toRaise,
      };
    });
  }

  /**
   * One run-level entry plus one per changed tenant, so the run shows up both in
   * the global audit log and in each tenant's own trail. auditService.record is
   * fire-and-forget and swallows its own errors, and this is only ever called
   * after every transaction has committed.
   */
  private recordAudit(
    plan: EntitlementSyncPlanRef,
    version: EntitlementSyncVersionRef,
    result: EntitlementSyncResult,
    reason: string,
    actor: AuditActor
  ): void {
    void auditService.record({
      actor,
      action: "PLAN_ENTITLEMENTS_SYNCED",
      category: "ENTITLEMENT",
      resourceId: version.id,
      resourceLabel: `${plan.name} v${version.version}`,
      summary:
        `Synced entitlements from ${plan.name} v${version.version} to ` +
        `${result.summary.tenants_changed} of ${result.summary.tenants_processed} tenants ` +
        `(${result.summary.entitlements_created} created, ${result.summary.entitlements_raised} raised)`,
      metadata: {
        plan_code: plan.code,
        source_version: version.version,
        reason,
        ...result.summary,
        // Compact per-tenant record. Full detail stays in each tenant's own entry.
        tenants: result.tenants.map((t) => ({
          tenant_id: t.tenant_id,
          outcome: t.outcome,
          created: t.entitlements_created,
          raised: t.entitlements_raised,
          ...(t.error ? { error: t.error } : {}),
        })),
      },
    });

    for (const tenant of result.tenants) {
      if (tenant.outcome === "NO_CHANGE") continue;

      void auditService.record({
        actor,
        action:
          tenant.outcome === "FAILED"
            ? "TENANT_ENTITLEMENTS_SYNC_FAILED"
            : "TENANT_ENTITLEMENTS_SYNCED",
        category: "ENTITLEMENT",
        resourceId: version.id,
        resourceLabel: `${plan.name} v${version.version}`,
        tenantId: tenant.tenant_id,
        summary:
          tenant.outcome === "FAILED"
            ? `Entitlement sync from ${plan.name} v${version.version} failed for ${tenant.tenant_name}: ${tenant.error}`
            : `Granted ${tenant.entitlements_created} and raised ${tenant.entitlements_raised} entitlements ` +
              `on ${tenant.tenant_name} from ${plan.name} v${version.version}`,
        metadata: {
          plan_code: plan.code,
          source_version: version.version,
          reason,
          created_product_codes: tenant.created_product_codes,
          raised_product_codes: tenant.raised_product_codes,
          applications_granted: tenant.applications_granted,
          ...(tenant.error ? { error: tenant.error } : {}),
        },
      });
    }
  }
}

export default new PlanEntitlementSyncService();
