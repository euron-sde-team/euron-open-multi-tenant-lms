import { sql } from "kysely";
import { db } from "../db/connection";
import usageService, { type ReconcileResult } from "./usage.service";
import { computeWindowStart } from "../repositories/usage-counters.repository";
import logger from "../utils/logger";

/**
 * Source-of-truth queries per product code.
 * Each returns the actual count/value for a given tenant.
 */
const PRODUCT_QUERIES: Record<
  string,
  (tenantId: string) => Promise<number>
> = {
  self_paced_courses_count: async (tenantId) => {
    const result = await db
      .selectFrom("courses")
      .select(sql<number>`count(*)::int`.as("count"))
      .where("tenant_id", "=", tenantId)
      .where("status", "=", "PUBLISHED")
      .where("mode", "=", "SELF_PACED")
      .executeTakeFirstOrThrow();
    return Number(result.count);
  },

  books_count: async (tenantId) => {
    const result = await db
      .selectFrom("books")
      .select(sql<number>`count(*)::int`.as("count"))
      .where("tenant_id", "=", tenantId)
      .where("status", "=", "PUBLISHED")
      .executeTakeFirstOrThrow();
    return Number(result.count);
  },

  instructors_count: async (tenantId) => {
    const result = await db
      .selectFrom("instructors")
      .select(sql<number>`count(*)::int`.as("count"))
      .where("tenant_id", "=", tenantId)
      .executeTakeFirstOrThrow();
    return Number(result.count);
  },

  bundles_count: async (tenantId) => {
    const result = await db
      .selectFrom("bundles")
      .select(sql<number>`count(*)::int`.as("count"))
      .where("tenant_id", "=", tenantId)
      .where("status", "=", "PUBLISHED")
      .executeTakeFirstOrThrow();
    return Number(result.count);
  },

};

/**
 * Source-of-truth queries for MONTHLY-windowed products.
 * Each receives tenantId and the current month start date.
 */
const MONTHLY_PRODUCT_QUERIES: Record<
  string,
  (tenantId: string, monthStart: Date) => Promise<number>
> = {};

class ReconciliationService {
  /**
   * Reconcile a single tenant: run all product queries and compare against counters.
   */
  async reconcileTenant(
    tenantId: string,
    autoCorrect: boolean = false
  ): Promise<Map<string, ReconcileResult>> {
    const results = new Map<string, ReconcileResult>();

    // LIFETIME counter reconciliation
    for (const [productCode, queryFn] of Object.entries(PRODUCT_QUERIES)) {
      try {
        const actualCount = await queryFn(tenantId);
        const result = await usageService.reconcile(
          tenantId,
          productCode,
          actualCount,
          autoCorrect,
          "Scheduled reconciliation"
        );
        results.set(productCode, result);

        if (result.drift !== 0) {
          logger.info(
            `[reconciliation] tenant=${tenantId} product=${productCode} ` +
              `counter=${result.previousValue} actual=${result.actualValue} ` +
              `drift=${result.drift} corrected=${result.corrected}`
          );
        }
      } catch (err) {
        logger.error(
          `[reconciliation] Failed for tenant=${tenantId} product=${productCode}: ` +
            `${err instanceof Error ? err.message : String(err)}`
        );
      }
    }

    // MONTHLY counter reconciliation (no monthly tenant-scoped products today)
    const monthStart = computeWindowStart("MONTHLY");
    if (monthStart) {
      for (const [productCode, queryFn] of Object.entries(MONTHLY_PRODUCT_QUERIES)) {
        try {
          const actualCount = await queryFn(tenantId, monthStart);
          const result = await usageService.reconcileScoped(
            tenantId,
            productCode,
            actualCount,
            "TENANT",
            "__TENANT__",
            "MONTHLY",
            autoCorrect,
            "Monthly reconciliation"
          );
          results.set(productCode, result);

          if (result.drift !== 0) {
            logger.info(
              `[reconciliation] tenant=${tenantId} product=${productCode} (MONTHLY) ` +
                `counter=${result.previousValue} actual=${result.actualValue} ` +
                `drift=${result.drift} corrected=${result.corrected}`
            );
          }
        } catch (err) {
          logger.error(
            `[reconciliation] Failed for tenant=${tenantId} product=${productCode} (MONTHLY): ` +
              `${err instanceof Error ? err.message : String(err)}`
          );
        }
      }
    }

    return results;
  }

  /**
   * Reconcile all tenants (for scheduled background job).
   */
  async reconcileAll(
    autoCorrect: boolean = false
  ): Promise<{ tenantsProcessed: number; driftsFound: number; corrected: number }> {
    const tenants = await db
      .selectFrom("tenants")
      .select("id")
      .where("status", "=", "ACTIVE")
      .execute();

    let driftsFound = 0;
    let corrected = 0;

    for (const tenant of tenants) {
      const results = await this.reconcileTenant(tenant.id, autoCorrect);
      for (const result of results.values()) {
        if (result.drift !== 0) {
          driftsFound++;
          if (result.corrected) corrected++;
        }
      }
    }

    logger.info(
      `[reconciliation] Completed: ${tenants.length} tenants, ` +
        `${driftsFound} drifts found, ${corrected} corrected`
    );

    return { tenantsProcessed: tenants.length, driftsFound, corrected };
  }
}

const reconciliationService = new ReconciliationService();
export default reconciliationService;
