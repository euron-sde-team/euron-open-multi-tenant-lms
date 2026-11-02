import type { Transaction } from "kysely";
import { ulid } from "ulid";
import { db } from "../db/connection";
import type { DB } from "../db/types";
import { EntitlementForbiddenError } from "../errors/entitlement-forbidden.error";
import entitlementsRepository from "../repositories/entitlements.repository";
import usageCountersRepository from "../repositories/usage-counters.repository";
import usageEventsRepository from "../repositories/usage-events.repository";
import logger from "../utils/logger";

const WARNING_THRESHOLD = 2;

export interface CheckCapacityResult {
  allowed: boolean;
  currentUsed: number;
  limit: number;
  isUnlimited: boolean;
  remainingSlots?: number;
  warning?: boolean;
}

export interface ScopeOptions {
  scopeType?: "TENANT" | "USER";
  scopeId?: string; // member ID when scope is USER
  windowType?: "LIFETIME" | "MONTHLY" | "YEARLY";
}

export interface ConsumeContext extends ScopeOptions {
  resourceType?: string;
  resourceId?: string;
  idempotencyKey?: string;
  actorType?: string;
  actorId?: string;
  reason?: string;
}

export interface ReleaseContext extends ScopeOptions {
  resourceType?: string;
  resourceId?: string;
  reason?: string;
}

export interface ReconcileResult {
  previousValue: number;
  actualValue: number;
  drift: number;
  corrected: boolean;
}

class UsageService {
  /**
   * Check capacity: reads limit from entitlements, reads usage from counters.
   * Default deny: no active entitlement row means a limit of 0.
   *
   * When scope options are provided (e.g., USER/MONTHLY), reads the scoped counter
   * instead of the default TENANT/LIFETIME counter. Entitlement limits are always
   * tenant-level, scoped counters track per-user consumption against the same limit.
   */
  async checkCapacity(
    tenantId: string,
    productCode: string,
    amount: number = 1,
    scope?: ScopeOptions
  ): Promise<CheckCapacityResult> {
    const scopeType = scope?.scopeType ?? "TENANT";
    const scopeId = scope?.scopeId ?? "__TENANT__";
    const windowType = scope?.windowType ?? "LIFETIME";

    const [entitlement, counter] = await Promise.all([
      entitlementsRepository.findByTenantAndProduct(tenantId, productCode),
      scopeType === "TENANT" && windowType === "LIFETIME"
        ? usageCountersRepository.findByTenantAndProduct(tenantId, productCode)
        : usageCountersRepository.findScoped(tenantId, productCode, scopeType, scopeId, windowType),
    ]);

    const currentUsed = counter ? Number(counter.current_value) : 0;

    // Default deny: no active entitlement row means the plan grants nothing
    if (!entitlement || !entitlement.is_active) {
      return { allowed: false, currentUsed, limit: 0, isUnlimited: false, remainingSlots: 0 };
    }

    const limit = entitlement.limit_value;
    const isUnlimited = Boolean(entitlement.is_unlimited);

    if (isUnlimited) {
      return { allowed: true, currentUsed, limit, isUnlimited: true };
    }

    const allowed = currentUsed + amount <= limit;
    const remainingSlots = Math.max(0, limit - currentUsed);
    const warning = remainingSlots <= WARNING_THRESHOLD;

    return {
      allowed,
      currentUsed,
      limit,
      isUnlimited: false,
      remainingSlots,
      warning,
    };
  }

  /**
   * Consume: check capacity → increment counter → record event.
   * The counter increment and event recording happen in a transaction.
   *
   * When scope fields are provided in context (scopeType, scopeId, windowType),
   * uses a scoped counter (e.g., per-user monthly). Otherwise uses default TENANT/LIFETIME.
   */
  async consume(
    tenantId: string,
    productCode: string,
    amount: number = 1,
    context: ConsumeContext = {},
    outerTrx?: Transaction<DB>
  ): Promise<{ newValue: number }> {
    const scopeType = context.scopeType ?? "TENANT";
    const scopeId = context.scopeId ?? "__TENANT__";
    const windowType = context.windowType ?? "LIFETIME";

    // Ensure counter exists (outside txn to avoid 23505 poisoning a serializable txn)
    const counter = await usageCountersRepository.ensureCounter(
      tenantId,
      productCode,
      scopeType,
      scopeId,
      windowType
    );

    // Read entitlement limit (immutable during txn, no lock needed)
    const entitlement = await entitlementsRepository.findByTenantAndProduct(
      tenantId,
      productCode
    );

    // Lock counter → check capacity → increment → record event
    const executeConsume = async (trx: Transaction<DB>) => {
      // Idempotency check first
      if (context.idempotencyKey) {
        const exists = await usageEventsRepository.existsByIdempotencyKey(
          context.idempotencyKey,
          trx
        );
        if (exists) {
          const current = scopeType === "TENANT" && windowType === "LIFETIME"
            ? await usageCountersRepository.findByTenantAndProduct(tenantId, productCode, trx)
            : await usageCountersRepository.findScoped(tenantId, productCode, scopeType, scopeId, windowType, trx);
          return { newValue: current ? Number(current.current_value) : 0 };
        }
      }

      // Re-read counter WITH lock inside transaction to prevent TOCTOU race
      const locked = await trx
        .selectFrom("tenant_usage_counters")
        .selectAll()
        .where("id", "=", counter.id)
        .forUpdate()
        .executeTakeFirstOrThrow();

      const currentUsed = Number(locked.current_value);

      // Capacity check with locked value. Default deny: no active entitlement
      // row is a limit of 0.
      if (!entitlement || !entitlement.is_active) {
        throw new EntitlementForbiddenError(
          "This feature is not included in your plan.",
          {
            code: "ENTITLEMENT_LIMIT_REACHED",
            productCode,
            currentUsed,
            limit: 0,
            isUnlimited: false,
          }
        );
      }
      if (!entitlement.is_unlimited) {
        if (currentUsed + amount > entitlement.limit_value) {
          throw new EntitlementForbiddenError(
            "Limit reached. Upgrade your plan to add more.",
            {
              code: "ENTITLEMENT_LIMIT_REACHED",
              productCode,
              featureKey: entitlement.feature_key,
              currentUsed,
              limit: entitlement.limit_value,
              isUnlimited: false,
            }
          );
        }
      }

      const updated = await usageCountersRepository.increment(
        counter.id,
        amount,
        trx
      );

      await usageEventsRepository.create(
        {
          id: ulid(),
          tenant_id: tenantId,
          product_code: productCode,
          event_type: "CONSUME",
          delta: amount,
          resulting_value: Number(updated.current_value),
          resource_type: context.resourceType ?? null,
          resource_id: context.resourceId ?? null,
          idempotency_key: context.idempotencyKey ?? null,
          actor_type: context.actorType ?? "SYSTEM",
          actor_id: context.actorId ?? null,
          reason: context.reason ?? null,
          scope_type: scopeType,
          scope_id: scopeId,
        },
        trx
      );

      return { newValue: Number(updated.current_value) };
    };

    if (outerTrx) {
      return executeConsume(outerTrx);
    }
    return db.transaction().execute(executeConsume);
  }

  /**
   * Release: decrement counter → record event.
   * Safe if no counter exists (no-op).
   *
   * When scope fields are provided in context, targets the scoped counter.
   */
  async release(
    tenantId: string,
    productCode: string,
    amount: number = 1,
    context: ReleaseContext = {},
    outerTrx?: Transaction<DB>
  ): Promise<{ newValue: number }> {
    const scopeType = context.scopeType ?? "TENANT";
    const scopeId = context.scopeId ?? "__TENANT__";
    const windowType = context.windowType ?? "LIFETIME";

    const counter = scopeType === "TENANT" && windowType === "LIFETIME"
      ? await usageCountersRepository.findByTenantAndProduct(tenantId, productCode, outerTrx)
      : await usageCountersRepository.findScoped(tenantId, productCode, scopeType, scopeId, windowType, outerTrx);

    // No counter = nothing to release
    if (!counter) {
      return { newValue: 0 };
    }

    const executeRelease = async (trx: Transaction<DB>) => {
      const updated = await usageCountersRepository.decrement(
        counter.id,
        amount,
        trx
      );

      await usageEventsRepository.create(
        {
          id: ulid(),
          tenant_id: tenantId,
          product_code: productCode,
          event_type: "RELEASE",
          delta: -amount,
          resulting_value: Number(updated.current_value),
          resource_type: context.resourceType ?? null,
          resource_id: context.resourceId ?? null,
          actor_type: "SYSTEM",
          reason: context.reason ?? null,
          scope_type: scopeType,
          scope_id: scopeId,
        },
        trx
      );

      return { newValue: Number(updated.current_value) };
    };

    if (outerTrx) {
      return executeRelease(outerTrx);
    }
    return db.transaction().execute(executeRelease);
  }

  /**
   * Reconcile: compare counter against actual resource count.
   * Optionally correct if autoCorrect is true.
   */
  async reconcile(
    tenantId: string,
    productCode: string,
    actualCount: number,
    autoCorrect: boolean = false,
    reason?: string
  ): Promise<ReconcileResult> {
    const counter = await usageCountersRepository.ensureCounter(
      tenantId,
      productCode
    );
    const previousValue = Number(counter.current_value);
    const drift = previousValue - actualCount;

    if (drift !== 0 && autoCorrect) {
      await db.transaction().execute(async (trx) => {
        await usageCountersRepository.setValue(counter.id, actualCount, trx);
        await usageEventsRepository.create(
          {
            id: ulid(),
            tenant_id: tenantId,
            product_code: productCode,
            event_type: "RECONCILE",
            delta: actualCount - previousValue,
            resulting_value: actualCount,
            reason:
              reason ??
              `Reconciliation: counter was ${previousValue}, actual is ${actualCount} (drift: ${drift})`,
            actor_type: "SYSTEM",
          },
          trx
        );
      });
      await usageCountersRepository.markReconciled(counter.id, actualCount);
      logger.info(
        `[usage] Reconciled tenant=${tenantId} product=${productCode}: ${previousValue} → ${actualCount} (drift: ${drift})`
      );
    } else if (drift === 0) {
      await usageCountersRepository.markReconciled(counter.id, actualCount);
    }

    return {
      previousValue,
      actualValue: actualCount,
      drift,
      corrected: drift !== 0 && autoCorrect,
    };
  }

  /**
   * Reconcile a scoped/windowed counter (e.g., MONTHLY/TENANT).
   * Similar to reconcile() but supports non-LIFETIME counters.
   */
  async reconcileScoped(
    tenantId: string,
    productCode: string,
    actualCount: number,
    scopeType: string,
    scopeId: string,
    windowType: string,
    autoCorrect: boolean = false,
    reason?: string
  ): Promise<ReconcileResult> {
    const counter = await usageCountersRepository.ensureCounter(
      tenantId,
      productCode,
      scopeType,
      scopeId,
      windowType
    );
    const previousValue = Number(counter.current_value);
    const drift = previousValue - actualCount;

    if (drift !== 0 && autoCorrect) {
      await db.transaction().execute(async (trx) => {
        await usageCountersRepository.setValue(counter.id, actualCount, trx);
        await usageEventsRepository.create(
          {
            id: ulid(),
            tenant_id: tenantId,
            product_code: productCode,
            event_type: "RECONCILE",
            delta: actualCount - previousValue,
            resulting_value: actualCount,
            reason:
              reason ??
              `Scoped reconciliation (${windowType}): counter was ${previousValue}, actual is ${actualCount} (drift: ${drift})`,
            actor_type: "SYSTEM",
            scope_type: scopeType,
            scope_id: scopeId,
          },
          trx
        );
      });
      await usageCountersRepository.markReconciled(counter.id, actualCount);
      logger.info(
        `[usage] Reconciled (scoped) tenant=${tenantId} product=${productCode} window=${windowType}: ${previousValue} → ${actualCount} (drift: ${drift})`
      );
    } else if (drift === 0) {
      await usageCountersRepository.markReconciled(counter.id, actualCount);
    }

    return {
      previousValue,
      actualValue: actualCount,
      drift,
      corrected: drift !== 0 && autoCorrect,
    };
  }

  /**
   * Get current usage value for a product. Returns 0 if no counter exists.
   */
  async getCurrentUsage(
    tenantId: string,
    productCode: string
  ): Promise<number> {
    const counter = await usageCountersRepository.findByTenantAndProduct(
      tenantId,
      productCode
    );
    return counter ? Number(counter.current_value) : 0;
  }

  /**
   * Get all usage counters for a tenant (for merging into entitlements DTO).
   */
  async getAllUsage(
    tenantId: string
  ): Promise<Map<string, number>> {
    const counters = await usageCountersRepository.findAllByTenant(tenantId);
    const map = new Map<string, number>();
    for (const c of counters) {
      map.set(c.product_code, Number(c.current_value));
    }
    return map;
  }
}

const usageService = new UsageService();
export default usageService;
