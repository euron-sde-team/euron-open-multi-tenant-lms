import type { Transaction } from "kysely";
import { db } from "../db/connection";
import type { DB } from "../db/types";
import type { billing_cycle, discount_type } from "../db/enums";

/** Minimal shape returned by findLatestPublishedFreePlanVersion */
export interface FreePlanVersionRow {
  id: string;
  plan_id: string;
  version: number;
  published_at: Date;
}

/** Products attached to a plan_version, joined to product/feature for the
 * fields needed when inserting entitlements rows. */
export interface PlanVersionProductRow {
  product_id: string;
  product_code: string;
  feature_key: string;
  application_code: string;
  is_unlimited: boolean;
  limit_value: number;
}

export interface PlanListItem {
  id: string;
  plan_id: string;
  plan_code: string;
  plan_name: string;
  plan_description: string | null;
  sort_order: number;
  version: number;
  price_monthly_inr: number;
  price_yearly_inr: number;
  price_monthly_usd: number;
  price_yearly_usd: number;
  purchase_mode: string;
  pricing_frequency: string;
  price_two_yearly_inr: number;
  price_two_yearly_usd: number;
  is_active: boolean;
}

export interface PlanProductItem {
  product_code: string;
  product_title: string | null;
  feature_key: string;
  feature_name: string;
  feature_category: string;
  feature_sort_order: number;
  constraint_type: string;
  unit: string | null;
  limit_value: number;
  is_unlimited: boolean;
}

export interface PlanVersionDetail {
  id: string;
  plan_id: string;
  plan_code: string;
  plan_name: string;
  version: number;
  price_monthly_inr: number;
  price_yearly_inr: number;
  price_monthly_usd: number;
  price_yearly_usd: number;
  discount_monthly_inr_type: discount_type;
  discount_monthly_inr_value: number;
  discount_yearly_inr_type: discount_type;
  discount_yearly_inr_value: number;
  discount_monthly_usd_type: discount_type;
  discount_monthly_usd_value: number;
  discount_yearly_usd_type: discount_type;
  discount_yearly_usd_value: number;
  purchase_mode: string;
  price_two_yearly_inr: number;
  price_two_yearly_usd: number;
  discount_two_yearly_inr_type: discount_type;
  discount_two_yearly_inr_value: number;
  discount_two_yearly_usd_type: discount_type;
  discount_two_yearly_usd_value: number;
  pricing_frequency: string;
  is_active: boolean;
  published_at: Date | null;
  grace_period_days: number;
}

class PlansRepository {
  /**
   * List plans with active (published) versions for tenant subscription purchase.
   * Returns pricing in both INR and USD.
   */
  async listPlansWithActiveVersions(): Promise<PlanListItem[]> {
    const results = await db
      .selectFrom("plans")
      .innerJoin("plan_versions", "plan_versions.plan_id", "plans.id")
      .select([
        "plan_versions.id",
        "plans.id as plan_id",
        "plans.code as plan_code",
        "plans.name as plan_name",
        "plans.description as plan_description",
        "plans.sort_order",
        "plan_versions.version",
        "plan_versions.price_monthly_inr",
        "plan_versions.price_yearly_inr",
        "plan_versions.price_monthly_usd",
        "plan_versions.price_yearly_usd",
        "plan_versions.purchase_mode",
        "plan_versions.price_two_yearly_inr",
        "plan_versions.price_two_yearly_usd",
        "plan_versions.pricing_frequency",
        "plan_versions.is_active",
      ])
      .where("plans.is_active", "=", true)
      .where("plans.is_public", "=", true)
      .where("plan_versions.is_active", "=", true)
      .where("plan_versions.published_at", "is not", null)
      .orderBy("plans.sort_order", "asc")
      .orderBy("plans.name", "asc")
      .execute();

    return results.map((r) => ({
      id: r.id,
      plan_id: r.plan_id,
      plan_code: r.plan_code,
      plan_name: r.plan_name,
      plan_description: r.plan_description,
      sort_order: r.sort_order,
      version: r.version,
      price_monthly_inr: Number(r.price_monthly_inr),
      price_yearly_inr: Number(r.price_yearly_inr),
      price_monthly_usd: Number(r.price_monthly_usd),
      price_yearly_usd: Number(r.price_yearly_usd),
      purchase_mode: r.purchase_mode,
      price_two_yearly_inr: Number(r.price_two_yearly_inr ?? 0),
      price_two_yearly_usd: Number(r.price_two_yearly_usd ?? 0),
      pricing_frequency: r.pricing_frequency,
      is_active: r.is_active,
    }));
  }

  /**
   * Get plan version by ID with plan details.
   */
  async getPlanVersionById(
    planVersionId: string
  ): Promise<PlanVersionDetail | null> {
    const result = await db
      .selectFrom("plan_versions")
      .innerJoin("plans", "plan_versions.plan_id", "plans.id")
      .select([
        "plan_versions.id",
        "plan_versions.plan_id",
        "plans.code as plan_code",
        "plans.name as plan_name",
        "plan_versions.version",
        "plan_versions.price_monthly_inr",
        "plan_versions.price_yearly_inr",
        "plan_versions.price_monthly_usd",
        "plan_versions.price_yearly_usd",
        "plan_versions.discount_monthly_inr_type",
        "plan_versions.discount_monthly_inr_value",
        "plan_versions.discount_yearly_inr_type",
        "plan_versions.discount_yearly_inr_value",
        "plan_versions.discount_monthly_usd_type",
        "plan_versions.discount_monthly_usd_value",
        "plan_versions.discount_yearly_usd_type",
        "plan_versions.discount_yearly_usd_value",
        "plan_versions.purchase_mode",
        "plan_versions.price_two_yearly_inr",
        "plan_versions.price_two_yearly_usd",
        "plan_versions.discount_two_yearly_inr_type",
        "plan_versions.discount_two_yearly_inr_value",
        "plan_versions.discount_two_yearly_usd_type",
        "plan_versions.discount_two_yearly_usd_value",
        "plan_versions.pricing_frequency",
        "plan_versions.is_active",
        "plan_versions.published_at",
        "plan_versions.grace_period_days",
      ])
      .where("plan_versions.id", "=", planVersionId)
      .executeTakeFirst();

    if (!result) return null;

    return {
      id: result.id,
      plan_id: result.plan_id,
      plan_code: result.plan_code,
      plan_name: result.plan_name,
      version: result.version,
      price_monthly_inr: Number(result.price_monthly_inr),
      price_yearly_inr: Number(result.price_yearly_inr),
      price_monthly_usd: Number(result.price_monthly_usd),
      price_yearly_usd: Number(result.price_yearly_usd),
      discount_monthly_inr_type: result.discount_monthly_inr_type as discount_type,
      discount_monthly_inr_value: Number(result.discount_monthly_inr_value),
      discount_yearly_inr_type: result.discount_yearly_inr_type as discount_type,
      discount_yearly_inr_value: Number(result.discount_yearly_inr_value),
      discount_monthly_usd_type: result.discount_monthly_usd_type as discount_type,
      discount_monthly_usd_value: Number(result.discount_monthly_usd_value),
      discount_yearly_usd_type: result.discount_yearly_usd_type as discount_type,
      discount_yearly_usd_value: Number(result.discount_yearly_usd_value),
      purchase_mode: result.purchase_mode,
      price_two_yearly_inr: Number(result.price_two_yearly_inr ?? 0),
      price_two_yearly_usd: Number(result.price_two_yearly_usd ?? 0),
      discount_two_yearly_inr_type: result.discount_two_yearly_inr_type as discount_type,
      discount_two_yearly_inr_value: Number(result.discount_two_yearly_inr_value ?? 0),
      discount_two_yearly_usd_type: result.discount_two_yearly_usd_type as discount_type,
      discount_two_yearly_usd_value: Number(result.discount_two_yearly_usd_value ?? 0),
      pricing_frequency: result.pricing_frequency,
      is_active: result.is_active,
      published_at: result.published_at ? new Date(result.published_at) : null,
      grace_period_days: result.grace_period_days,
    };
  }

  /**
   * Apply discount to base price. Returns final price (never negative).
   */
  private applyDiscount(
    basePrice: number,
    discountType: discount_type,
    discountValue: number
  ): number {
    if (discountType === "NONE" || discountValue <= 0) return basePrice;
    if (discountType === "FIXED") {
      return Math.max(0, Math.round((basePrice - discountValue) * 100) / 100);
    }
    if (discountType === "PERCENTAGE") {
      const multiplier = Math.max(0, 1 - discountValue / 100);
      return Math.round(basePrice * multiplier * 100) / 100;
    }
    return basePrice;
  }

  /**
   * Get price for a plan version by billing cycle and currency.
   * Applies plan version discounts (PERCENTAGE or FIXED).
   * Returns amount in main unit (INR or USD), not smallest unit.
   */
  getPrice(
    planVersion: PlanVersionDetail,
    billingCycle: billing_cycle,
    currency: "INR" | "USD"
  ): number {
    if (currency === "INR") {
      const base =
        billingCycle === "TWO_YEARLY"
          ? planVersion.price_two_yearly_inr
          : billingCycle === "YEARLY"
            ? planVersion.price_yearly_inr
            : planVersion.price_monthly_inr;
      const discountType =
        billingCycle === "TWO_YEARLY"
          ? planVersion.discount_two_yearly_inr_type
          : billingCycle === "YEARLY"
            ? planVersion.discount_yearly_inr_type
            : planVersion.discount_monthly_inr_type;
      const discountValue =
        billingCycle === "TWO_YEARLY"
          ? planVersion.discount_two_yearly_inr_value
          : billingCycle === "YEARLY"
            ? planVersion.discount_yearly_inr_value
            : planVersion.discount_monthly_inr_value;
      return this.applyDiscount(base, discountType, discountValue);
    }
    const base =
      billingCycle === "TWO_YEARLY"
        ? planVersion.price_two_yearly_usd
        : billingCycle === "YEARLY"
          ? planVersion.price_yearly_usd
          : planVersion.price_monthly_usd;
    const discountType =
      billingCycle === "TWO_YEARLY"
        ? planVersion.discount_two_yearly_usd_type
        : billingCycle === "YEARLY"
          ? planVersion.discount_yearly_usd_type
          : planVersion.discount_monthly_usd_type;
    const discountValue =
      billingCycle === "TWO_YEARLY"
        ? planVersion.discount_two_yearly_usd_value
        : billingCycle === "YEARLY"
          ? planVersion.discount_yearly_usd_value
          : planVersion.discount_monthly_usd_value;
    return this.applyDiscount(base, discountType, discountValue);
  }
  /**
   * Fetch products for multiple plan versions in a single query.
   * Returns a map of planVersionId → PlanProductItem[].
   */
  async listPlanVersionProducts(
    planVersionIds: string[]
  ): Promise<Map<string, PlanProductItem[]>> {
    if (planVersionIds.length === 0) return new Map();

    const results = await db
      .selectFrom("plan_version_products")
      .innerJoin("products", "plan_version_products.product_id", "products.id")
      .innerJoin("features", "products.feature_id", "features.id")
      .select([
        "plan_version_products.plan_version_id",
        "products.code as product_code",
        "products.title as product_title",
        "products.constraint_type",
        "products.unit",
        "features.key as feature_key",
        "features.name as feature_name",
        "features.category as feature_category",
        "features.sort_order as feature_sort_order",
        "plan_version_products.limit_value",
        "plan_version_products.is_unlimited",
      ])
      .where("plan_version_products.plan_version_id", "in", planVersionIds)
      .orderBy("features.sort_order", "asc")
      .orderBy("features.key", "asc")
      .orderBy("products.code", "asc")
      .execute();

    const map = new Map<string, PlanProductItem[]>();
    for (const r of results) {
      const items = map.get(r.plan_version_id) || [];
      items.push({
        product_code: r.product_code,
        product_title: r.product_title,
        feature_key: r.feature_key,
        feature_name: r.feature_name ?? r.feature_key,
        feature_category: r.feature_category ?? "General",
        feature_sort_order: r.feature_sort_order,
        constraint_type: r.constraint_type,
        unit: r.unit,
        limit_value: r.limit_value,
        is_unlimited: r.is_unlimited,
      });
      map.set(r.plan_version_id, items);
    }
    return map;
  }

  /**
   * Find the latest PUBLISHED plan_version with purchase_mode=FREE.
   * Used by tenant auto-provisioning to grant new tenants a starter plan.
   *
   * "Latest" = highest published_at across all FREE plan_versions on
   * active+public plans. Returns null if none configured.
   */
  async findLatestPublishedFreePlanVersion(
    trx?: Transaction<DB>
  ): Promise<FreePlanVersionRow | null> {
    const executor = trx || db;
    const row = await executor
      .selectFrom("plan_versions")
      .innerJoin("plans", "plan_versions.plan_id", "plans.id")
      .select([
        "plan_versions.id",
        "plan_versions.plan_id",
        "plan_versions.version",
        "plan_versions.published_at",
      ])
      .where("plan_versions.purchase_mode", "=", "FREE")
      .where("plan_versions.is_active", "=", true)
      .where("plan_versions.published_at", "is not", null)
      .where("plans.is_active", "=", true)
      .orderBy("plan_versions.published_at", "desc")
      .orderBy("plan_versions.version", "desc")
      .limit(1)
      .executeTakeFirst();

    if (!row || !row.published_at) return null;
    return {
      id: row.id,
      plan_id: row.plan_id,
      version: row.version,
      published_at: new Date(row.published_at),
    };
  }

  /**
   * Fetch all products belonging to a plan_version, with the joined
   * application_code + feature_key fields needed to materialise entitlements.
   */
  async listProductsForPlanVersion(
    planVersionId: string,
    trx?: Transaction<DB>
  ): Promise<PlanVersionProductRow[]> {
    const executor = trx || db;
    const rows = await executor
      .selectFrom("plan_version_products")
      .innerJoin("products", "plan_version_products.product_id", "products.id")
      .innerJoin("features", "products.feature_id", "features.id")
      .innerJoin("applications", "features.application_id", "applications.id")
      .select([
        "plan_version_products.product_id",
        "products.code as product_code",
        "features.key as feature_key",
        "applications.code as application_code",
        "plan_version_products.is_unlimited",
        "plan_version_products.limit_value",
      ])
      .where("plan_version_products.plan_version_id", "=", planVersionId)
      .execute();

    return rows.map((r) => ({
      product_id: r.product_id,
      product_code: r.product_code,
      feature_key: r.feature_key,
      application_code: r.application_code,
      is_unlimited: r.is_unlimited,
      limit_value: r.limit_value,
    }));
  }

  /**
   * Fetch all application IDs linked to a plan via plan_applications.
   * Used when materialising tenant_applications rows on provisioning.
   */
  async listApplicationsForPlan(
    planId: string,
    trx?: Transaction<DB>
  ): Promise<string[]> {
    const executor = trx || db;
    const rows = await executor
      .selectFrom("plan_applications")
      .select("application_id")
      .where("plan_id", "=", planId)
      .execute();
    return rows.map((r) => r.application_id);
  }

  /**
   * Resolve product codes to feature display names.
   * Used to enrich eligibility conflict objects.
   */
  async resolveProductNames(
    productCodes: string[]
  ): Promise<Map<string, { feature_name: string; unit: string | null }>> {
    if (productCodes.length === 0) return new Map();

    const results = await db
      .selectFrom("products")
      .innerJoin("features", "products.feature_id", "features.id")
      .select([
        "products.code as product_code",
        "products.unit",
        "features.name as feature_name",
        "features.key as feature_key",
      ])
      .where("products.code", "in", productCodes)
      .execute();

    const map = new Map<string, { feature_name: string; unit: string | null }>();
    for (const r of results) {
      map.set(r.product_code, {
        feature_name: r.feature_name ?? r.feature_key,
        unit: r.unit,
      });
    }
    return map;
  }
}

export default new PlansRepository();
