import { sql } from "kysely";
import { ulid } from "ulid";
import entitlementRepository from "../repositories/entitlement.repository";
import tenantRepository from "../repositories/tenant.repository";
import productRepository from "../repositories/product.repository";
import { db } from "../db/connection";
import {
  EntitlementResponse,
  EntitlementQueryParams,
  EntitlementListResponse,
  OverrideEntitlementRequest,
  ResetUsageRequest,
  UpdateUsageRequest,
  CreateAdminEntitlementRequest,
  RevokeAdminEntitlementRequest,
  EntitlementCheckRequest,
  EntitlementCheckResponse,
  EntitlementConsumeRequest,
  EntitlementConsumeResponse,
  EntitlementOverrideResponse,
} from "../types/tenant.type";
import { NotFoundError } from "../errors/not-found.error";
import { BadRequestError } from "../errors/bad-request.error";
import { ConflictError } from "../errors/conflict-custom.error";
import { AuditActor } from "../types/audit-log.type";
import auditService from "./audit.service";
import logger from "../utils/logger";

/**
 * window_start of every LIFETIME usage counter (matches admin-api). A fixed
 * date, not NULL, so the counters' unique key rejects duplicate rows.
 */
const LIFETIME_WINDOW_START = new Date(Date.UTC(1970, 0, 1));

class EntitlementService {
  /**
   * List entitlements for a tenant
   */
  async listEntitlements(
    tenantId: string,
    params: EntitlementQueryParams
  ): Promise<EntitlementListResponse> {
    // Verify tenant exists
    const tenant = await tenantRepository.findById(tenantId);
    if (!tenant) {
      throw new NotFoundError(`Tenant with ID '${tenantId}' not found`);
    }

    const page = params.page || 1;
    const limit = params.limit || 50;

    const [{ entitlements, total }, usageMap] = await Promise.all([
      entitlementRepository.findByTenant(tenantId, params),
      this.getUsageFromCounters(tenantId),
    ]);

    return {
      data: await Promise.all(
        entitlements.map((e) =>
          this.mapToResponseWithDetails(e, usageMap.get(e.product_code) ?? e.used_value)
        )
      ),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  /**
   * Get entitlement by ID with override history
   */
  async getEntitlementById(
    tenantId: string,
    entitlementId: string
  ): Promise<EntitlementResponse> {
    const entitlement = await entitlementRepository.findByIdWithProduct(entitlementId);
    if (!entitlement || entitlement.tenant_id !== tenantId) {
      throw new NotFoundError(`Entitlement with ID '${entitlementId}' not found`);
    }

    const [overrideCount, latestOverride, usageMap] = await Promise.all([
      entitlementRepository.countOverrides(entitlementId),
      entitlementRepository.getLatestOverride(entitlementId),
      this.getUsageFromCounters(tenantId),
    ]);

    const usedValue = usageMap.get(entitlement.product_code) ?? entitlement.used_value;

    return {
      ...this.mapToResponse(entitlement, usedValue),
      product: {
        id: entitlement.product_id,
        code: entitlement.product_code,
        constraint_type: entitlement.product_constraint_type as "BOOLEAN" | "COUNT" | "LIMIT",
        unit: entitlement.product_unit,
        is_hard_limit: entitlement.product_is_hard_limit,
        feature_key: entitlement.feature_key,
        feature_name: entitlement.feature_name,
      },
      override_count: overrideCount,
      latest_override: latestOverride
        ? {
            id: latestOverride.id,
            entitlement_id: latestOverride.entitlement_id,
            old_limit_value: latestOverride.old_limit_value,
            new_limit_value: latestOverride.new_limit_value,
            reason: latestOverride.reason,
            admin_id: latestOverride.admin_id,
            created_at: latestOverride.created_at,
          }
        : null,
    };
  }

  /**
   * Override entitlement limit (with audit trail)
   */
  async overrideEntitlement(
    tenantId: string,
    entitlementId: string,
    data: OverrideEntitlementRequest,
    actor: AuditActor
  ): Promise<EntitlementResponse> {
    const adminId = actor.adminId ?? "";
    const entitlement = await entitlementRepository.findById(entitlementId);
    if (!entitlement || entitlement.tenant_id !== tenantId) {
      throw new NotFoundError(`Entitlement with ID '${entitlementId}' not found`);
    }

    if (!entitlement.is_active) {
      throw new BadRequestError("Cannot override an inactive entitlement");
    }

    if (!data.reason || data.reason.trim().length < 10) {
      throw new BadRequestError("Override reason is required (minimum 10 characters)");
    }

    if (data.new_limit_value < 0) {
      throw new BadRequestError("Limit value cannot be negative");
    }

    const now = new Date();

    // Execute in transaction
    await db.transaction().execute(async (trx) => {
      // 1. Create override record (audit trail)
      await entitlementRepository.createOverride(
        {
          id: ulid(),
          entitlement_id: entitlementId,
          old_limit_value: entitlement.limit_value,
          new_limit_value: data.new_limit_value,
          reason: data.reason,
          admin_id: adminId,
          created_at: now,
        },
        trx
      );

      // 2. Update entitlement
      await entitlementRepository.update(
        entitlementId,
        {
          limit_value: data.new_limit_value,
          is_unlimited: false, // Override makes it limited
          updated_at: now,
        },
        trx
      );
    });

    // Record the audit trail AFTER the transaction commits. Kept out of the
    // transaction so a slow/failed audit write can never delay the response or
    // roll back the override (auditService.record is fire-and-forget). The
    // entitlement_overrides row created above remains the atomic audit record.
    await auditService.record({
      actor,
      action: "ENTITLEMENT_OVERRIDDEN",
      category: "ENTITLEMENT",
      resourceId: entitlementId,
      resourceLabel: entitlement.product_code || entitlement.feature_key,
      tenantId,
      summary: `Overrode entitlement ${entitlement.product_code || entitlement.feature_key} limit from ${entitlement.limit_value} to ${data.new_limit_value}`,
      metadata: {
        old_limit_value: entitlement.limit_value,
        new_limit_value: data.new_limit_value,
        reason: data.reason,
      },
    });

    logger.info(
      `Overrode entitlement '${entitlementId}' for tenant '${tenantId}'. ` +
        `Old: ${entitlement.limit_value}, New: ${data.new_limit_value}. ` +
        `Admin: ${adminId}`
    );

    return this.getEntitlementById(tenantId, entitlementId);
  }

  /**
   * Reset entitlement usage (with audit)
   */
  async resetUsage(
    tenantId: string,
    entitlementId: string,
    data: ResetUsageRequest,
    adminId: string
  ): Promise<EntitlementResponse> {
    const entitlement = await entitlementRepository.findById(entitlementId);
    if (!entitlement || entitlement.tenant_id !== tenantId) {
      throw new NotFoundError(`Entitlement with ID '${entitlementId}' not found`);
    }

    if (!entitlement.is_active) {
      throw new BadRequestError("Cannot reset usage for an inactive entitlement");
    }

    if (!data.reason || data.reason.trim().length < 10) {
      throw new BadRequestError("Reset reason is required (minimum 10 characters)");
    }

    // Read current usage from counter
    const usageMap = await this.getUsageFromCounters(tenantId);
    const oldUsedValue = usageMap.get(entitlement.product_code) ?? 0;

    // Reset counter to 0 and record event in tenant_usage_counters/events
    await db.transaction().execute(async (trx) => {
      // 1. Reset counter to 0; use .returning("id") to detect if a row was actually updated
      const updated = await trx
        .updateTable("tenant_usage_counters")
        .set({ current_value: 0, updated_at: new Date() })
        .where("id", "=", (eb) =>
          eb
            .selectFrom("tenant_usage_counters as tuc")
            .select("id")
            .where("tuc.tenant_id", "=", tenantId)
            .where("tuc.product_code", "=", entitlement.product_code)
            .where("tuc.scope_type", "=", "TENANT")
            .where("tuc.window_type", "=", "LIFETIME")
            .orderBy("tuc.created_at", "asc")
            .limit(1)
        )
        .returning("id")
        .executeTakeFirst();

      // Only record event if a counter actually existed and was reset
      if (updated) {
        await trx
          .insertInto("tenant_usage_events")
          .values({
            id: ulid(),
            tenant_id: tenantId,
            product_code: entitlement.product_code,
            scope_type: "TENANT",
            scope_id: "__TENANT__",
            event_type: "RESET",
            delta: -oldUsedValue,
            resulting_value: 0,
            reason: data.reason,
            actor_type: "ADMIN",
            actor_id: adminId,
            created_at: new Date(),
          })
          .execute();
      }
    });

    logger.info(
      `Reset usage for entitlement '${entitlementId}' for tenant '${tenantId}'. ` +
        `Previous: ${oldUsedValue}. Admin: ${adminId}. Reason: ${data.reason}`
    );

    return this.getEntitlementById(tenantId, entitlementId);
  }

  /**
   * Update entitlement usage to an arbitrary value (with audit)
   */
  async updateUsage(
    tenantId: string,
    entitlementId: string,
    data: UpdateUsageRequest,
    adminId: string
  ): Promise<EntitlementResponse> {
    const entitlement = await entitlementRepository.findById(entitlementId);
    if (!entitlement || entitlement.tenant_id !== tenantId) {
      throw new NotFoundError(`Entitlement with ID '${entitlementId}' not found`);
    }

    if (!entitlement.is_active) {
      throw new BadRequestError("Cannot update usage for an inactive entitlement");
    }

    if (!data.reason || data.reason.trim().length < 10) {
      throw new BadRequestError("Reason is required (minimum 10 characters)");
    }

    if (data.new_used_value < 0) {
      throw new BadRequestError("Used value cannot be negative");
    }

    if (!Number.isInteger(data.new_used_value)) {
      throw new BadRequestError("Used value must be an integer");
    }

    // Read current usage from counter
    const usageMap = await this.getUsageFromCounters(tenantId);
    const oldUsedValue = usageMap.get(entitlement.product_code) ?? 0;
    const delta = data.new_used_value - oldUsedValue;

    // Update counter and record event
    await db.transaction().execute(async (trx) => {
      // 1. Upsert counter to new value
      const existingCounter = await trx
        .selectFrom("tenant_usage_counters")
        .select("id")
        .where("tenant_id", "=", tenantId)
        .where("product_code", "=", entitlement.product_code)
        .where("scope_type", "=", "TENANT")
        .where("window_type", "=", "LIFETIME")
        .orderBy("created_at", "asc")
        .executeTakeFirst();

      if (existingCounter) {
        await trx
          .updateTable("tenant_usage_counters")
          .set({ current_value: data.new_used_value, updated_at: new Date() })
          .where("id", "=", existingCounter.id)
          .execute();
      } else {
        await trx
          .insertInto("tenant_usage_counters")
          .values({
            id: ulid(),
            tenant_id: tenantId,
            product_code: entitlement.product_code,
            scope_type: "TENANT",
            scope_id: "__TENANT__",
            window_type: "LIFETIME",
            window_start: LIFETIME_WINDOW_START,
            current_value: data.new_used_value,
            created_at: new Date(),
            updated_at: new Date(),
          })
          .execute();
      }

      // 2. Record event in tenant_usage_events
      await trx
        .insertInto("tenant_usage_events")
        .values({
          id: ulid(),
          tenant_id: tenantId,
          product_code: entitlement.product_code,
          scope_type: "TENANT",
          scope_id: "__TENANT__",
          event_type: "RECONCILE",
          delta,
          resulting_value: data.new_used_value,
          reason: data.reason,
          actor_type: "ADMIN",
          actor_id: adminId,
          created_at: new Date(),
        })
        .execute();
    });

    logger.info(
      `Updated usage for entitlement '${entitlementId}' for tenant '${tenantId}'. ` +
        `Old: ${oldUsedValue}, New: ${data.new_used_value}. ` +
        `Admin: ${adminId}. Reason: ${data.reason}`
    );

    return this.getEntitlementById(tenantId, entitlementId);
  }

  /**
   * Check entitlement (canConsume)
   * This is the primary runtime check for authorization
   */
  async checkEntitlement(data: EntitlementCheckRequest): Promise<EntitlementCheckResponse> {
    const amount = data.amount || 1;

    const entitlement = await entitlementRepository.findByTenantAndFeature(
      data.tenant_id,
      data.feature_key
    );

    if (!entitlement) {
      return {
        allowed: false,
        reason: "NOT_FOUND",
      };
    }

    // Read usage from counter
    const usageMap = await this.getUsageFromCounters(data.tenant_id);
    const usedValue = usageMap.get(entitlement.product_code) ?? 0;

    if (!entitlement.is_active) {
      return {
        allowed: false,
        reason: "INACTIVE",
        entitlement: {
          id: entitlement.id,
          is_unlimited: entitlement.is_unlimited,
          limit_value: entitlement.limit_value,
          used_value: usedValue,
          available: entitlement.is_unlimited
            ? Infinity
            : entitlement.limit_value - usedValue,
        },
      };
    }

    // Unlimited entitlements always allow
    if (entitlement.is_unlimited) {
      return {
        allowed: true,
        reason: "OK",
        entitlement: {
          id: entitlement.id,
          is_unlimited: true,
          limit_value: entitlement.limit_value,
          used_value: usedValue,
          available: Infinity,
        },
      };
    }

    const available = entitlement.limit_value - usedValue;
    const allowed = available >= amount;

    return {
      allowed,
      reason: allowed ? "OK" : "LIMIT_REACHED",
      entitlement: {
        id: entitlement.id,
        is_unlimited: false,
        limit_value: entitlement.limit_value,
        used_value: usedValue,
        available,
      },
    };
  }

  /**
   * Consume entitlement (increment usage)
   * This is idempotent when idempotency_key is provided
   */
  async consumeEntitlement(data: EntitlementConsumeRequest): Promise<EntitlementConsumeResponse> {
    const amount = data.amount || 1;

    const entitlement = await entitlementRepository.findByTenantAndFeature(
      data.tenant_id,
      data.feature_key
    );

    if (!entitlement) {
      throw new NotFoundError(`No entitlement found for feature '${data.feature_key}'`);
    }

    if (!entitlement.is_active) {
      throw new BadRequestError("Entitlement is not active");
    }

    // Execute in transaction, lock counter → check capacity → increment → record event
    const newUsedValue = await db.transaction().execute(async (trx) => {
      // Idempotency check first
      if (data.idempotency_key) {
        const exists = await this.usageEventExistsByIdempotencyKey(data.idempotency_key);
        if (exists) {
          const currentMap = await this.getUsageFromCounters(data.tenant_id);
          const currentUsed = currentMap.get(entitlement.product_code) ?? 0;
          return { idempotent: true, value: currentUsed };
        }
      }

      // Ensure counter exists, then lock it
      const existing = await trx
        .selectFrom("tenant_usage_counters")
        .select(["id", "current_value"])
        .where("tenant_id", "=", data.tenant_id)
        .where("product_code", "=", entitlement.product_code)
        .where("scope_type", "=", "TENANT")
        .where("window_type", "=", "LIFETIME")
        .orderBy("created_at", "asc")
        .forUpdate()
        .executeTakeFirst();

      let newValue: number;
      if (existing) {
        const currentUsed = Number(existing.current_value);

        // Capacity check with locked value
        if (!entitlement.is_unlimited) {
          const available = entitlement.limit_value - currentUsed;
          if (available < amount) {
            throw new BadRequestError(
              `Insufficient entitlement. Available: ${available}, Requested: ${amount}`
            );
          }
        }

        const updated = await trx
          .updateTable("tenant_usage_counters")
          .set((eb) => ({
            current_value: eb("current_value", "+", amount),
            updated_at: new Date(),
          }))
          .where("id", "=", existing.id)
          .returning("current_value")
          .executeTakeFirstOrThrow();
        newValue = Number(updated.current_value);
      } else {
        // No counter exists, current usage is 0, check capacity
        if (!entitlement.is_unlimited && amount > entitlement.limit_value) {
          throw new BadRequestError(
            `Insufficient entitlement. Available: ${entitlement.limit_value}, Requested: ${amount}`
          );
        }

        await trx
          .insertInto("tenant_usage_counters")
          .values({
            id: ulid(),
            tenant_id: data.tenant_id,
            product_code: entitlement.product_code,
            scope_type: "TENANT",
            scope_id: "__TENANT__",
            window_type: "LIFETIME",
            window_start: LIFETIME_WINDOW_START,
            current_value: amount,
            created_at: new Date(),
            updated_at: new Date(),
          })
          .execute();
        newValue = amount;
      }

      // Record event
      await trx
        .insertInto("tenant_usage_events")
        .values({
          id: ulid(),
          tenant_id: data.tenant_id,
          product_code: entitlement.product_code,
          scope_type: "TENANT",
          scope_id: "__TENANT__",
          event_type: "CONSUME",
          delta: amount,
          resulting_value: newValue,
          resource_type: data.resource_type || null,
          resource_id: data.resource_id || null,
          idempotency_key: data.idempotency_key || null,
          actor_type: "ADMIN",
          created_at: new Date(),
        })
        .execute();

      return { idempotent: false, value: newValue };
    });

    return {
      success: true,
      entitlement_id: entitlement.id,
      new_used_value: newUsedValue.value,
      remaining: entitlement.is_unlimited
        ? "unlimited"
        : entitlement.limit_value - newUsedValue.value,
    };
  }

  /**
   * Get override history for an entitlement
   */
  async getOverrideHistory(
    tenantId: string,
    entitlementId: string
  ): Promise<EntitlementOverrideResponse[]> {
    const entitlement = await entitlementRepository.findById(entitlementId);
    if (!entitlement || entitlement.tenant_id !== tenantId) {
      throw new NotFoundError(`Entitlement with ID '${entitlementId}' not found`);
    }

    const overrides = await entitlementRepository.getOverrides(entitlementId);

    return overrides.map((o) => ({
      id: o.id,
      entitlement_id: o.entitlement_id,
      old_limit_value: o.old_limit_value,
      new_limit_value: o.new_limit_value,
      reason: o.reason,
      admin_id: o.admin_id,
      created_at: o.created_at,
    }));
  }

  // ============================================
  // ADMIN ENTITLEMENT GRANT / REVOKE
  // ============================================

  /**
   * Create an ADMIN-sourced entitlement for a tenant (standalone, not tied to subscription/addon).
   * Rejects if the tenant already has an active entitlement for the same product.
   */
  async createAdminEntitlement(
    tenantId: string,
    data: CreateAdminEntitlementRequest,
    adminId: string
  ): Promise<EntitlementResponse & { warnings?: string[] }> {
    // 1. Verify tenant exists
    const tenant = await tenantRepository.findById(tenantId);
    if (!tenant) {
      throw new NotFoundError(`Tenant with ID '${tenantId}' not found`);
    }

    // 2. Verify product exists and get details
    const product = await productRepository.findByIdWithDetails(data.product_id);
    if (!product) {
      throw new NotFoundError(`Product with ID '${data.product_id}' not found`);
    }

    // 3. Validate reason
    if (!data.reason || data.reason.trim().length < 10) {
      throw new BadRequestError("Reason is required (minimum 10 characters)");
    }

    // 4. Validate limit_value by constraint_type
    const constraintType = product.constraint_type as string;
    let limitValue = data.limit_value;
    let isUnlimited = data.is_unlimited ?? false;

    if (constraintType === "BOOLEAN") {
      limitValue = 1;
      isUnlimited = false;
    } else {
      if (limitValue < 0 && !isUnlimited) {
        throw new BadRequestError("Limit value cannot be negative");
      }
      if (!Number.isInteger(limitValue) && !isUnlimited) {
        throw new BadRequestError("Limit value must be an integer");
      }
    }

    // 5. Check for existing active entitlement (prevent duplicates)
    const existing = await entitlementRepository.findByTenantAndProduct(tenantId, product.code);
    if (existing) {
      throw new ConflictError(
        `An active ${existing.source}-sourced entitlement already exists for product '${product.code}'. ` +
        `Use the Override action to change its limit instead.`
      );
    }

    // 6. Check if tenant has the application assigned (for warning)
    const warnings: string[] = [];
    const tenantApp = await db
      .selectFrom("tenant_applications")
      .select("id")
      .where("tenant_id", "=", tenantId)
      .where("application_id", "=", product.application_id)
      .where("status", "in", ["ACTIVE", "TRIALING"])
      .executeTakeFirst();

    if (!tenantApp) {
      warnings.push(
        `Entitlement created, but the application '${product.application_code}' is not assigned to this tenant. ` +
        `The entitlement will not be effective until the application is granted.`
      );
    }

    const now = new Date();
    const entitlementId = ulid();

    // 7. Create entitlement in transaction
    await db.transaction().execute(async (trx) => {
      await entitlementRepository.create(
        {
          id: entitlementId,
          tenant_id: tenantId,
          product_id: data.product_id,
          application_code: product.application_code,
          feature_key: product.feature_key,
          product_code: product.code,
          is_unlimited: isUnlimited,
          limit_value: isUnlimited ? 0 : limitValue,
          used_value: 0,
          source: "ADMIN",
          source_subscription_id: null,
          source_plan_version_id: null,
          source_addon_id: null,
          is_active: true,
          created_at: now,
          updated_at: now,
        },
        trx
      );
    });

    logger.info(
      `Created ADMIN entitlement '${entitlementId}' for tenant '${tenantId}'. ` +
        `Product: ${product.code}, Limit: ${isUnlimited ? "unlimited" : limitValue}. ` +
        `Admin: ${adminId}. Reason: ${data.reason}`
    );

    const response = await this.getEntitlementById(tenantId, entitlementId);
    return { ...response, warnings: warnings.length > 0 ? warnings : undefined };
  }

  /**
   * Revoke (archive) an ADMIN-sourced entitlement.
   * Only ADMIN-sourced entitlements can be revoked through this method.
   */
  async revokeAdminEntitlement(
    tenantId: string,
    entitlementId: string,
    data: RevokeAdminEntitlementRequest,
    adminId: string
  ): Promise<EntitlementResponse> {
    const entitlement = await entitlementRepository.findById(entitlementId);
    if (!entitlement || entitlement.tenant_id !== tenantId) {
      throw new NotFoundError(`Entitlement with ID '${entitlementId}' not found`);
    }

    if (entitlement.source !== "ADMIN") {
      throw new BadRequestError(
        `Only ADMIN-sourced entitlements can be revoked. This entitlement is sourced from '${entitlement.source}'.`
      );
    }

    if (!entitlement.is_active) {
      throw new BadRequestError("Cannot revoke an already inactive entitlement");
    }

    if (!data.reason || data.reason.trim().length < 10) {
      throw new BadRequestError("Reason is required (minimum 10 characters)");
    }

    const now = new Date();

    await db.transaction().execute(async (trx) => {
      // 1. Archive the entitlement
      await entitlementRepository.update(
        entitlementId,
        {
          is_active: false,
          archived_at: now,
          updated_at: now,
        },
        trx
      );

      // 2. Create override record as audit trail
      await entitlementRepository.createOverride(
        {
          id: ulid(),
          entitlement_id: entitlementId,
          old_limit_value: entitlement.limit_value,
          new_limit_value: 0,
          reason: `REVOKED: ${data.reason}`,
          admin_id: adminId,
          created_at: now,
        },
        trx
      );
    });

    logger.info(
      `Revoked ADMIN entitlement '${entitlementId}' for tenant '${tenantId}'. ` +
        `Product: ${entitlement.product_code}. Admin: ${adminId}. Reason: ${data.reason}`
    );

    return this.getEntitlementById(tenantId, entitlementId);
  }

  // ============================================
  // RECONCILIATION
  // ============================================

  /**
   * Reconcile usage counters for a tenant by counting actual resources.
   * Corrects any drift between counters and reality.
   */
  async reconcileUsage(
    tenantId: string
  ): Promise<Record<string, { previousValue: number; actualValue: number; drift: number; corrected: boolean }>> {
    // Verify tenant exists
    const tenant = await tenantRepository.findById(tenantId);
    if (!tenant) {
      throw new NotFoundError(`Tenant with ID '${tenantId}' not found`);
    }

    // Source-of-truth queries per product code
    const productQueries: Record<string, () => Promise<number>> = {
      self_paced_courses_count: async () => {
        const result = await db
          .selectFrom("courses")
          .select(sql<number>`count(*)::int`.as("count"))
          .where("tenant_id", "=", tenantId)
          .where("status", "=", "PUBLISHED")
          .where("mode", "=", "SELF_PACED")
          .executeTakeFirstOrThrow();
        return Number(result.count);
      },
      books_count: async () => {
        const result = await db
          .selectFrom("books")
          .select(sql<number>`count(*)::int`.as("count"))
          .where("tenant_id", "=", tenantId)
          .where("status", "=", "PUBLISHED")
          .executeTakeFirstOrThrow();
        return Number(result.count);
      },
      bundles_count: async () => {
        const result = await db
          .selectFrom("bundles")
          .select(sql<number>`count(*)::int`.as("count"))
          .where("tenant_id", "=", tenantId)
          .where("status", "=", "PUBLISHED")
          .executeTakeFirstOrThrow();
        return Number(result.count);
      },
      instructors_count: async () => {
        const result = await db
          .selectFrom("instructors")
          .select(sql<number>`count(*)::int`.as("count"))
          .where("tenant_id", "=", tenantId)
          .executeTakeFirstOrThrow();
        return Number(result.count);
      },
    };

    const usageMap = await this.getUsageFromCounters(tenantId);
    const results: Record<string, { previousValue: number; actualValue: number; drift: number; corrected: boolean }> = {};

    for (const [productCode, queryFn] of Object.entries(productQueries)) {
      try {
        const actualValue = await queryFn();
        const previousValue = usageMap.get(productCode) ?? 0;
        const drift = previousValue - actualValue;

        if (drift !== 0) {
          // Correct the counter
          await db.transaction().execute(async (trx) => {
            const existingCounter = await trx
              .selectFrom("tenant_usage_counters")
              .select("id")
              .where("tenant_id", "=", tenantId)
              .where("product_code", "=", productCode)
              .where("scope_type", "=", "TENANT")
              .where("window_type", "=", "LIFETIME")
              .orderBy("created_at", "asc")
              .executeTakeFirst();

            if (existingCounter) {
              await trx
                .updateTable("tenant_usage_counters")
                .set({ current_value: actualValue, updated_at: new Date() })
                .where("id", "=", existingCounter.id)
                .execute();
            } else {
              await trx
                .insertInto("tenant_usage_counters")
                .values({
                  id: ulid(),
                  tenant_id: tenantId,
                  product_code: productCode,
                  scope_type: "TENANT",
                  scope_id: "__TENANT__",
                  window_type: "LIFETIME",
                  window_start: LIFETIME_WINDOW_START,
                  current_value: actualValue,
                  created_at: new Date(),
                  updated_at: new Date(),
                })
                .execute();
            }

            await trx
              .insertInto("tenant_usage_events")
              .values({
                id: ulid(),
                tenant_id: tenantId,
                product_code: productCode,
                scope_type: "TENANT",
                scope_id: "__TENANT__",
                event_type: "RECONCILE",
                delta: actualValue - previousValue,
                resulting_value: actualValue,
                reason: "Admin-triggered reconciliation",
                actor_type: "SYSTEM",
                created_at: new Date(),
              })
              .execute();
          });

          logger.info(
            `[reconciliation] tenant=${tenantId} product=${productCode} ` +
              `counter=${previousValue} actual=${actualValue} drift=${drift} corrected=true`
          );
        }

        results[productCode] = { previousValue, actualValue, drift, corrected: drift !== 0 };
      } catch (err) {
        logger.error(
          `[reconciliation] Failed for tenant=${tenantId} product=${productCode}: ` +
            `${err instanceof Error ? err.message : String(err)}`
        );
        results[productCode] = { previousValue: 0, actualValue: 0, drift: 0, corrected: false };
      }
    }

    return results;
  }

  // ============================================
  // PRIVATE HELPERS
  // ============================================

  private mapToResponse(
    entitlement: {
      id: string;
      tenant_id: string;
      product_id: string;
      application_code: string;
      feature_key: string;
      product_code: string;
      is_unlimited: boolean;
      limit_value: number;
      used_value: number;
      source: string;
      source_subscription_id: string | null;
      source_plan_version_id: string | null;
      source_addon_id: string | null;
      is_active: boolean;
      archived_at: Date | null;
      created_at: Date;
      updated_at: Date;
    },
    usedValueOverride?: number
  ): EntitlementResponse {
    const usedValue = usedValueOverride ?? entitlement.used_value;
    const available = entitlement.is_unlimited
      ? Infinity
      : entitlement.limit_value - usedValue;
    const usagePercentage = entitlement.is_unlimited
      ? 0
      : entitlement.limit_value > 0
        ? (usedValue / entitlement.limit_value) * 100
        : 0;

    return {
      id: entitlement.id,
      tenant_id: entitlement.tenant_id,
      product_id: entitlement.product_id,
      application_code: entitlement.application_code,
      feature_key: entitlement.feature_key,
      product_code: entitlement.product_code,
      is_unlimited: entitlement.is_unlimited,
      limit_value: entitlement.limit_value,
      used_value: usedValue,
      available_value: available,
      usage_percentage: Math.round(usagePercentage * 100) / 100,
      source: entitlement.source as EntitlementResponse["source"],
      source_subscription_id: entitlement.source_subscription_id,
      source_plan_version_id: entitlement.source_plan_version_id,
      source_addon_id: entitlement.source_addon_id,
      is_active: entitlement.is_active,
      archived_at: entitlement.archived_at,
      created_at: entitlement.created_at,
      updated_at: entitlement.updated_at,
    };
  }

  private async mapToResponseWithDetails(
    entitlement: {
      id: string;
      tenant_id: string;
      product_id: string;
      application_code: string;
      feature_key: string;
      product_code: string;
      is_unlimited: boolean;
      limit_value: number;
      used_value: number;
      source: string;
      source_subscription_id: string | null;
      source_plan_version_id: string | null;
      source_addon_id: string | null;
      is_active: boolean;
      archived_at: Date | null;
      created_at: Date;
      updated_at: Date;
      product_constraint_type: string;
      product_unit: string | null;
      product_is_hard_limit: boolean;
      feature_name: string | null;
    },
    usedValueOverride?: number
  ): Promise<EntitlementResponse> {
    const overrideCount = await entitlementRepository.countOverrides(entitlement.id);

    return {
      ...this.mapToResponse(entitlement, usedValueOverride),
      product: {
        id: entitlement.product_id,
        code: entitlement.product_code,
        constraint_type: entitlement.product_constraint_type as "BOOLEAN" | "COUNT" | "LIMIT",
        unit: entitlement.product_unit,
        is_hard_limit: entitlement.product_is_hard_limit,
        feature_key: entitlement.feature_key,
        feature_name: entitlement.feature_name,
      },
      override_count: overrideCount,
    };
  }

  private async getUsageFromCounters(tenantId: string): Promise<Map<string, number>> {
    return entitlementRepository.getUsageCounters(tenantId);
  }

  /**
   * Check if a usage event exists by idempotency key in tenant_usage_events.
   */
  private async usageEventExistsByIdempotencyKey(key: string): Promise<boolean> {
    const result = await db
      .selectFrom("tenant_usage_events")
      .select("id")
      .where("idempotency_key", "=", key)
      .executeTakeFirst();
    return !!result;
  }
}

export default new EntitlementService();
