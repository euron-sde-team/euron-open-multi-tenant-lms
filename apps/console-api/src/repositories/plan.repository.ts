import { Transaction } from "kysely";
import { db } from "../db/connection";
import { DB } from "../db/types";
import {
  ConstraintType,
  DiscountType,
  PlanType,
  PlanVersionProductInput,
} from "../types/catalog.type";

// Define proper types for repository use
interface Plan {
  id: string;
  code: string;
  name: string;
  description: string | null;
  plan_type: PlanType;
  sort_order: number;
  is_active: boolean;
  is_public: boolean;
  created_at: Date;
  updated_at: Date;
}

interface PlanInsert {
  id: string;
  code: string;
  name: string;
  description?: string | null;
  plan_type?: PlanType;
  sort_order?: number;
  is_active?: boolean;
  is_public?: boolean;
  created_at: Date;
  updated_at: Date;
}

interface PlanUpdate {
  name?: string;
  description?: string | null;
  sort_order?: number;
  is_active?: boolean;
  is_public?: boolean;
  updated_at?: Date;
}

type PricingFrequency = "MONTHLY" | "YEARLY" | "TWO_YEARLY" | "BOTH" | "ALL";
type PurchaseMode = "FREE" | "PAID";

interface PlanVersion {
  id: string;
  plan_id: string;
  version: number;
  pricing_frequency: PricingFrequency;
  purchase_mode: PurchaseMode;
  price_monthly_inr: number;
  price_yearly_inr: number;
  discount_monthly_inr_type: DiscountType;
  discount_monthly_inr_value: number;
  discount_yearly_inr_type: DiscountType;
  discount_yearly_inr_value: number;
  price_monthly_usd: number;
  price_yearly_usd: number;
  discount_monthly_usd_type: DiscountType;
  discount_monthly_usd_value: number;
  discount_yearly_usd_type: DiscountType;
  discount_yearly_usd_value: number;
  price_two_yearly_inr: number;
  price_two_yearly_usd: number;
  discount_two_yearly_inr_type: DiscountType;
  discount_two_yearly_inr_value: number;
  discount_two_yearly_usd_type: DiscountType;
  discount_two_yearly_usd_value: number;
  is_active: boolean;
  published_at: Date | null;
  retired_at: Date | null;
  // Offer metadata
  is_offer: boolean;
  offer_name: string | null;
  offer_description: string | null;
  offer_valid_from: Date | null;
  offer_valid_to: Date | null;
  created_at: Date;
}

interface PlanVersionInsert {
  id: string;
  plan_id: string;
  version: number;
  pricing_frequency?: PricingFrequency;
  purchase_mode?: PurchaseMode;
  price_monthly_inr: number;
  price_yearly_inr: number;
  discount_monthly_inr_type?: DiscountType;
  discount_monthly_inr_value?: number;
  discount_yearly_inr_type?: DiscountType;
  discount_yearly_inr_value?: number;
  price_monthly_usd: number;
  price_yearly_usd: number;
  discount_monthly_usd_type?: DiscountType;
  discount_monthly_usd_value?: number;
  discount_yearly_usd_type?: DiscountType;
  discount_yearly_usd_value?: number;
  price_two_yearly_inr?: number;
  price_two_yearly_usd?: number;
  discount_two_yearly_inr_type?: DiscountType;
  discount_two_yearly_inr_value?: number;
  discount_two_yearly_usd_type?: DiscountType;
  discount_two_yearly_usd_value?: number;
  is_active?: boolean;
  published_at?: Date | null;
  // Offer metadata
  is_offer?: boolean;
  offer_name?: string | null;
  offer_description?: string | null;
  offer_valid_from?: Date | null;
  offer_valid_to?: Date | null;
  created_at: Date;
}

interface PlanVersionProduct {
  id: string;
  plan_version_id: string;
  product_id: string;
  limit_value: number;
  is_unlimited: boolean;
  created_at: Date;
}

interface PlanVersionProductWithDetails extends PlanVersionProduct {
  product_code: string;
  feature_key: string;
  constraint_type: ConstraintType;
  unit: string | null;
}

interface PlanApplication {
  id: string;
  plan_id: string;
  application_id: string;
  created_at: Date;
}

interface PlanApplicationWithDetails extends PlanApplication {
  application_code: string;
  application_name: string;
}

class PlanRepository {
  // ============================================
  // PLAN CRUD
  // ============================================

  /**
   * Find plan by ID
   */
  async findById(id: string): Promise<Plan | undefined> {
    const result = await db
      .selectFrom("plans")
      .selectAll()
      .where("id", "=", id)
      .executeTakeFirst();

    if (!result) return undefined;

    return {
      ...result,
      plan_type: result.plan_type as PlanType,
      is_active: result.is_active as boolean,
      is_public: result.is_public as boolean,
      created_at: new Date(result.created_at),
      updated_at: new Date(result.updated_at),
    };
  }

  /**
   * Find plan by code
   */
  async findByCode(code: string): Promise<Plan | undefined> {
    const result = await db
      .selectFrom("plans")
      .selectAll()
      .where("code", "=", code)
      .executeTakeFirst();

    if (!result) return undefined;

    return {
      ...result,
      plan_type: result.plan_type as PlanType,
      is_active: result.is_active as boolean,
      is_public: result.is_public as boolean,
      created_at: new Date(result.created_at),
      updated_at: new Date(result.updated_at),
    };
  }

  /**
   * Find all plans with optional filters
   */
  async findAll(params?: {
    plan_type?: PlanType;
    is_active?: boolean;
    is_public?: boolean;
    has_active_version?: boolean;
    search?: string;
    limit?: number;
    offset?: number;
  }): Promise<Plan[]> {
    let query = db.selectFrom("plans").selectAll("plans");

    if (params?.plan_type) {
      query = query.where("plans.plan_type", "=", params.plan_type);
    }

    if (params?.is_active !== undefined) {
      query = query.where("plans.is_active", "=", params.is_active);
    }

    if (params?.is_public !== undefined) {
      query = query.where("plans.is_public", "=", params.is_public);
    }

    if (params?.search) {
      query = query.where((eb) =>
        eb.or([
          eb("plans.name", "ilike", `%${params.search}%`),
          eb("plans.code", "ilike", `%${params.search}%`),
        ])
      );
    }

    // Filter by whether plan has an active (published) version
    if (params?.has_active_version !== undefined) {
      if (params.has_active_version) {
        query = query.where((eb) =>
          eb.exists(
            eb
              .selectFrom("plan_versions")
              .select("plan_versions.id")
              .whereRef("plan_versions.plan_id", "=", "plans.id")
              .where("plan_versions.is_active", "=", true)
          )
        );
      } else {
        query = query.where((eb) =>
          eb.not(
            eb.exists(
              eb
                .selectFrom("plan_versions")
                .select("plan_versions.id")
                .whereRef("plan_versions.plan_id", "=", "plans.id")
                .where("plan_versions.is_active", "=", true)
            )
          )
        );
      }
    }

    // Sort: plans with an active version first, then by sort_order, then name
    query = query
      .orderBy(
        (eb) =>
          eb
            .case()
            .when(
              eb.exists(
                eb
                  .selectFrom("plan_versions")
                  .select("plan_versions.id")
                  .whereRef("plan_versions.plan_id", "=", "plans.id")
                  .where("plan_versions.is_active", "=", true)
              )
            )
            .then(0)
            .else(1)
            .end(),
        "asc"
      )
      .orderBy("plans.sort_order", "asc")
      .orderBy("plans.name", "asc");

    if (params?.limit) {
      query = query.limit(params.limit);
    }

    if (params?.offset) {
      query = query.offset(params.offset);
    }

    const results = await query.execute();

    return results.map((r) => ({
      ...r,
      plan_type: r.plan_type as PlanType,
      is_active: r.is_active as boolean,
      is_public: r.is_public as boolean,
      created_at: new Date(r.created_at),
      updated_at: new Date(r.updated_at),
    }));
  }

  /**
   * Count plans with optional filters
   */
  async count(params?: {
    plan_type?: PlanType;
    is_active?: boolean;
    is_public?: boolean;
    has_active_version?: boolean;
    search?: string;
  }): Promise<number> {
    let query = db.selectFrom("plans").select(db.fn.count("plans.id").as("count"));

    if (params?.plan_type) {
      query = query.where("plans.plan_type", "=", params.plan_type);
    }

    if (params?.is_active !== undefined) {
      query = query.where("plans.is_active", "=", params.is_active);
    }

    if (params?.is_public !== undefined) {
      query = query.where("plans.is_public", "=", params.is_public);
    }

    if (params?.search) {
      query = query.where((eb) =>
        eb.or([
          eb("plans.name", "ilike", `%${params.search}%`),
          eb("plans.code", "ilike", `%${params.search}%`),
        ])
      );
    }

    if (params?.has_active_version !== undefined) {
      if (params.has_active_version) {
        query = query.where((eb) =>
          eb.exists(
            eb
              .selectFrom("plan_versions")
              .select("plan_versions.id")
              .whereRef("plan_versions.plan_id", "=", "plans.id")
              .where("plan_versions.is_active", "=", true)
          )
        );
      } else {
        query = query.where((eb) =>
          eb.not(
            eb.exists(
              eb
                .selectFrom("plan_versions")
                .select("plan_versions.id")
                .whereRef("plan_versions.plan_id", "=", "plans.id")
                .where("plan_versions.is_active", "=", true)
            )
          )
        );
      }
    }

    const result = await query.executeTakeFirst();
    return Number(result?.count ?? 0);
  }

  /**
   * Create a new plan
   */
  async create(data: PlanInsert): Promise<Plan> {
    const result = await db
      .insertInto("plans")
      .values({
        id: data.id,
        code: data.code,
        name: data.name,
        description: data.description ?? null,
        plan_type: data.plan_type ?? "SINGLE_APP",
        sort_order: data.sort_order ?? 0,
        is_active: data.is_active ?? true,
        is_public: data.is_public ?? true,
        created_at: data.created_at,
        updated_at: data.updated_at,
      })
      .returningAll()
      .executeTakeFirstOrThrow();

    return {
      ...result,
      plan_type: result.plan_type as PlanType,
      is_active: result.is_active as boolean,
      is_public: result.is_public as boolean,
      created_at: new Date(result.created_at),
      updated_at: new Date(result.updated_at),
    };
  }

  /**
   * Update a plan
   */
  async update(id: string, data: PlanUpdate): Promise<Plan | undefined> {
    const updateData: Record<string, unknown> = {
      updated_at: new Date(),
    };

    if (data.name !== undefined) updateData.name = data.name;
    if (data.description !== undefined) updateData.description = data.description;
    if (data.sort_order !== undefined) updateData.sort_order = data.sort_order;
    if (data.is_active !== undefined) updateData.is_active = data.is_active;
    if (data.is_public !== undefined) updateData.is_public = data.is_public;

    const result = await db
      .updateTable("plans")
      .set(updateData)
      .where("id", "=", id)
      .returningAll()
      .executeTakeFirst();

    if (!result) return undefined;

    return {
      ...result,
      plan_type: result.plan_type as PlanType,
      is_active: result.is_active as boolean,
      is_public: result.is_public as boolean,
      created_at: new Date(result.created_at),
      updated_at: new Date(result.updated_at),
    };
  }

  /**
   * Soft delete (deactivate) a plan
   */
  async deactivate(id: string): Promise<boolean> {
    const result = await db
      .updateTable("plans")
      .set({
        is_active: false,
        updated_at: new Date(),
      })
      .where("id", "=", id)
      .executeTakeFirst();

    return (result.numUpdatedRows ?? 0n) > 0n;
  }

  /**
   * Check if code exists (for validation)
   */
  async codeExists(code: string, excludeId?: string): Promise<boolean> {
    let query = db.selectFrom("plans").select("id").where("code", "=", code);

    if (excludeId) {
      query = query.where("id", "!=", excludeId);
    }

    const result = await query.executeTakeFirst();
    return !!result;
  }

  // ============================================
  // PLAN VERSION CRUD
  // ============================================

  /**
   * Find version by ID
   */
  async findVersionById(id: string): Promise<PlanVersion | undefined> {
    const result = await db
      .selectFrom("plan_versions")
      .selectAll()
      .where("id", "=", id)
      .executeTakeFirst();

    if (!result) return undefined;

    return this.mapPlanVersion(result);
  }

  /**
   * Find all versions for a plan
   */
  async findVersionsByPlanId(planId: string): Promise<PlanVersion[]> {
    const results = await db
      .selectFrom("plan_versions")
      .selectAll()
      .where("plan_id", "=", planId)
      .orderBy("version", "desc")
      .execute();

    return results.map((r) => this.mapPlanVersion(r));
  }

  /**
   * Find active version for a plan
   */
  async findActiveVersion(planId: string): Promise<PlanVersion | undefined> {
    const result = await db
      .selectFrom("plan_versions")
      .selectAll()
      .where("plan_id", "=", planId)
      .where("is_active", "=", true)
      .executeTakeFirst();

    if (!result) return undefined;

    return this.mapPlanVersion(result);
  }

  /**
   * Find latest version for a plan (most recently created, regardless of status)
   */
  async findLatestVersion(planId: string): Promise<PlanVersion | undefined> {
    const result = await db
      .selectFrom("plan_versions")
      .selectAll()
      .where("plan_id", "=", planId)
      .orderBy("version", "desc")
      .limit(1)
      .executeTakeFirst();

    if (!result) return undefined;

    return this.mapPlanVersion(result);
  }

  /**
   * Get next version number for a plan
   */
  async getNextVersionNumber(planId: string): Promise<number> {
    const result = await db
      .selectFrom("plan_versions")
      .select(db.fn.max("version").as("max_version"))
      .where("plan_id", "=", planId)
      .executeTakeFirst();

    return (Number(result?.max_version) || 0) + 1;
  }

  /**
   * Count versions for a plan
   */
  async countVersions(planId: string): Promise<number> {
    const result = await db
      .selectFrom("plan_versions")
      .select(db.fn.count("id").as("count"))
      .where("plan_id", "=", planId)
      .executeTakeFirst();

    return Number(result?.count ?? 0);
  }

  /**
   * Create a new version (without products - use createVersionWithProducts for atomic creation)
   */
  async createVersion(
    data: PlanVersionInsert,
    trx?: Transaction<DB>
  ): Promise<PlanVersion> {
    const executor = trx ?? db;

    const result = await executor
      .insertInto("plan_versions")
      .values({
        id: data.id,
        plan_id: data.plan_id,
        version: data.version,
        pricing_frequency: data.pricing_frequency ?? "BOTH",
        price_monthly_inr: String(data.price_monthly_inr),
        price_yearly_inr: String(data.price_yearly_inr),
        discount_monthly_inr_type: data.discount_monthly_inr_type ?? "NONE",
        discount_monthly_inr_value: String(data.discount_monthly_inr_value ?? 0),
        discount_yearly_inr_type: data.discount_yearly_inr_type ?? "NONE",
        discount_yearly_inr_value: String(data.discount_yearly_inr_value ?? 0),
        price_monthly_usd: String(data.price_monthly_usd),
        price_yearly_usd: String(data.price_yearly_usd),
        discount_monthly_usd_type: data.discount_monthly_usd_type ?? "NONE",
        discount_monthly_usd_value: String(data.discount_monthly_usd_value ?? 0),
        discount_yearly_usd_type: data.discount_yearly_usd_type ?? "NONE",
        discount_yearly_usd_value: String(data.discount_yearly_usd_value ?? 0),
        price_two_yearly_inr: String(data.price_two_yearly_inr ?? 0),
        price_two_yearly_usd: String(data.price_two_yearly_usd ?? 0),
        discount_two_yearly_inr_type: data.discount_two_yearly_inr_type ?? "NONE",
        discount_two_yearly_inr_value: String(data.discount_two_yearly_inr_value ?? 0),
        discount_two_yearly_usd_type: data.discount_two_yearly_usd_type ?? "NONE",
        discount_two_yearly_usd_value: String(data.discount_two_yearly_usd_value ?? 0),
        purchase_mode: data.purchase_mode ?? "PAID",
        is_active: data.is_active ?? false,
        published_at: data.published_at ?? null,
        // Offer metadata
        is_offer: data.is_offer ?? false,
        offer_name: data.offer_name ?? null,
        offer_description: data.offer_description ?? null,
        offer_valid_from: data.offer_valid_from ?? null,
        offer_valid_to: data.offer_valid_to ?? null,
        created_at: data.created_at,
      })
      .returningAll()
      .executeTakeFirstOrThrow();

    return this.mapPlanVersion(result);
  }

  /**
   * Create a new version with products atomically (transaction)
   */
  async createVersionWithProducts(
    versionData: PlanVersionInsert,
    products: Array<{ id: string } & PlanVersionProductInput>
  ): Promise<PlanVersion> {
    return await db.transaction().execute(async (trx) => {
      // Create the version
      const version = await this.createVersion(versionData, trx);

      // Create products
      if (products.length > 0) {
        const productRecords = products.map((p) => ({
          id: p.id,
          plan_version_id: version.id,
          product_id: p.product_id,
          limit_value: p.limit_value,
          is_unlimited: p.is_unlimited ?? false,
          created_at: new Date(),
        }));

        await trx.insertInto("plan_version_products").values(productRecords).execute();
      }

      return version;
    });
  }

  /**
   * Publish a version (deactivate current active + activate this one)
   */
  async publishVersion(planId: string, versionId: string): Promise<PlanVersion> {
    return await db.transaction().execute(async (trx) => {
      // Deactivate current active version
      await trx
        .updateTable("plan_versions")
        .set({
          is_active: false,
          retired_at: new Date(),
        })
        .where("plan_id", "=", planId)
        .where("is_active", "=", true)
        .execute();

      // Activate the new version (clear retired_at to allow reactivation of retired versions)
      const result = await trx
        .updateTable("plan_versions")
        .set({
          is_active: true,
          published_at: new Date(),
          retired_at: null,
        })
        .where("id", "=", versionId)
        .returningAll()
        .executeTakeFirstOrThrow();

      return this.mapPlanVersion(result);
    });
  }

  /**
   * Retire a version
   */
  async retireVersion(versionId: string): Promise<PlanVersion> {
    const result = await db
      .updateTable("plan_versions")
      .set({
        is_active: false,
        retired_at: new Date(),
      })
      .where("id", "=", versionId)
      .returningAll()
      .executeTakeFirstOrThrow();

    return this.mapPlanVersion(result);
  }

  /**
   * Update a draft version's pricing and offer fields (only for unpublished versions)
   */
  async updateVersion(
    versionId: string,
    data: {
      price_monthly_inr?: number;
      price_yearly_inr?: number;
      discount_monthly_inr_type?: DiscountType;
      discount_monthly_inr_value?: number;
      discount_yearly_inr_type?: DiscountType;
      discount_yearly_inr_value?: number;
      price_monthly_usd?: number;
      price_yearly_usd?: number;
      discount_monthly_usd_type?: DiscountType;
      discount_monthly_usd_value?: number;
      discount_yearly_usd_type?: DiscountType;
      discount_yearly_usd_value?: number;
      price_two_yearly_inr?: number;
      price_two_yearly_usd?: number;
      discount_two_yearly_inr_type?: DiscountType;
      discount_two_yearly_inr_value?: number;
      discount_two_yearly_usd_type?: DiscountType;
      discount_two_yearly_usd_value?: number;
      purchase_mode?: PurchaseMode;
      // Offer fields
      is_offer?: boolean;
      offer_name?: string | null;
      offer_description?: string | null;
      offer_valid_from?: Date | null;
      offer_valid_to?: Date | null;
    }
  ): Promise<PlanVersion> {
    const updateData: Record<string, unknown> = {};

    // Pricing fields
    if (data.price_monthly_inr !== undefined) {
      updateData.price_monthly_inr = String(data.price_monthly_inr);
    }
    if (data.price_yearly_inr !== undefined) {
      updateData.price_yearly_inr = String(data.price_yearly_inr);
    }
    if (data.discount_monthly_inr_type !== undefined) {
      updateData.discount_monthly_inr_type = data.discount_monthly_inr_type;
    }
    if (data.discount_monthly_inr_value !== undefined) {
      updateData.discount_monthly_inr_value = String(data.discount_monthly_inr_value);
    }
    if (data.discount_yearly_inr_type !== undefined) {
      updateData.discount_yearly_inr_type = data.discount_yearly_inr_type;
    }
    if (data.discount_yearly_inr_value !== undefined) {
      updateData.discount_yearly_inr_value = String(data.discount_yearly_inr_value);
    }
    if (data.price_monthly_usd !== undefined) {
      updateData.price_monthly_usd = String(data.price_monthly_usd);
    }
    if (data.price_yearly_usd !== undefined) {
      updateData.price_yearly_usd = String(data.price_yearly_usd);
    }
    if (data.discount_monthly_usd_type !== undefined) {
      updateData.discount_monthly_usd_type = data.discount_monthly_usd_type;
    }
    if (data.discount_monthly_usd_value !== undefined) {
      updateData.discount_monthly_usd_value = String(data.discount_monthly_usd_value);
    }
    if (data.discount_yearly_usd_type !== undefined) {
      updateData.discount_yearly_usd_type = data.discount_yearly_usd_type;
    }
    if (data.discount_yearly_usd_value !== undefined) {
      updateData.discount_yearly_usd_value = String(data.discount_yearly_usd_value);
    }
    if (data.price_two_yearly_inr !== undefined) {
      updateData.price_two_yearly_inr = String(data.price_two_yearly_inr);
    }
    if (data.price_two_yearly_usd !== undefined) {
      updateData.price_two_yearly_usd = String(data.price_two_yearly_usd);
    }
    if (data.discount_two_yearly_inr_type !== undefined) {
      updateData.discount_two_yearly_inr_type = data.discount_two_yearly_inr_type;
    }
    if (data.discount_two_yearly_inr_value !== undefined) {
      updateData.discount_two_yearly_inr_value = String(data.discount_two_yearly_inr_value);
    }
    if (data.discount_two_yearly_usd_type !== undefined) {
      updateData.discount_two_yearly_usd_type = data.discount_two_yearly_usd_type;
    }
    if (data.discount_two_yearly_usd_value !== undefined) {
      updateData.discount_two_yearly_usd_value = String(data.discount_two_yearly_usd_value);
    }
    if (data.purchase_mode !== undefined) {
      updateData.purchase_mode = data.purchase_mode;
    }

    // Offer fields
    if (data.is_offer !== undefined) {
      updateData.is_offer = data.is_offer;
    }
    if (data.offer_name !== undefined) {
      updateData.offer_name = data.offer_name;
    }
    if (data.offer_description !== undefined) {
      updateData.offer_description = data.offer_description;
    }
    if (data.offer_valid_from !== undefined) {
      updateData.offer_valid_from = data.offer_valid_from;
    }
    if (data.offer_valid_to !== undefined) {
      updateData.offer_valid_to = data.offer_valid_to;
    }

    const result = await db
      .updateTable("plan_versions")
      .set(updateData)
      .where("id", "=", versionId)
      .returningAll()
      .executeTakeFirstOrThrow();

    return this.mapPlanVersion(result);
  }

  // ============================================
  // PLAN VERSION PRODUCTS
  // ============================================

  /**
   * Get products for a version
   */
  async getVersionProducts(versionId: string): Promise<PlanVersionProductWithDetails[]> {
    const results = await db
      .selectFrom("plan_version_products")
      .innerJoin("products", "products.id", "plan_version_products.product_id")
      .innerJoin("features", "features.id", "products.feature_id")
      .select([
        "plan_version_products.id",
        "plan_version_products.plan_version_id",
        "plan_version_products.product_id",
        "plan_version_products.limit_value",
        "plan_version_products.is_unlimited",
        "plan_version_products.created_at",
        "products.code as product_code",
        "products.constraint_type",
        "products.unit",
        "features.key as feature_key",
      ])
      .where("plan_version_products.plan_version_id", "=", versionId)
      .orderBy("features.key", "asc")
      .orderBy("products.code", "asc")
      .execute();

    return results.map((r) => ({
      ...r,
      is_unlimited: r.is_unlimited as boolean,
      constraint_type: r.constraint_type as ConstraintType,
      created_at: new Date(r.created_at),
    }));
  }

  /**
   * Add product to version
   */
  async addVersionProduct(data: {
    id: string;
    plan_version_id: string;
    product_id: string;
    limit_value: number;
    is_unlimited?: boolean;
  }): Promise<PlanVersionProduct> {
    const result = await db
      .insertInto("plan_version_products")
      .values({
        id: data.id,
        plan_version_id: data.plan_version_id,
        product_id: data.product_id,
        limit_value: data.limit_value,
        is_unlimited: data.is_unlimited ?? false,
        created_at: new Date(),
      })
      .returningAll()
      .executeTakeFirstOrThrow();

    return {
      ...result,
      is_unlimited: result.is_unlimited as boolean,
      created_at: new Date(result.created_at),
    };
  }

  /**
   * Remove product from version
   */
  async removeVersionProduct(versionId: string, productId: string): Promise<boolean> {
    const result = await db
      .deleteFrom("plan_version_products")
      .where("plan_version_id", "=", versionId)
      .where("product_id", "=", productId)
      .executeTakeFirst();

    return (result.numDeletedRows ?? 0n) > 0n;
  }

  /**
   * Check if product exists in version
   */
  async hasVersionProduct(versionId: string, productId: string): Promise<boolean> {
    const result = await db
      .selectFrom("plan_version_products")
      .select("id")
      .where("plan_version_id", "=", versionId)
      .where("product_id", "=", productId)
      .executeTakeFirst();

    return !!result;
  }

  // ============================================
  // PLAN APPLICATIONS
  // ============================================

  /**
   * Get applications linked to a plan
   */
  async getPlanApplications(planId: string): Promise<PlanApplicationWithDetails[]> {
    const results = await db
      .selectFrom("plan_applications")
      .innerJoin("applications", "applications.id", "plan_applications.application_id")
      .select([
        "plan_applications.id",
        "plan_applications.plan_id",
        "plan_applications.application_id",
        "plan_applications.created_at",
        "applications.code as application_code",
        "applications.name as application_name",
      ])
      .where("plan_applications.plan_id", "=", planId)
      .orderBy("applications.name", "asc")
      .execute();

    return results.map((r) => ({
      ...r,
      created_at: new Date(r.created_at),
    }));
  }

  /**
   * Link application to plan
   */
  async linkApplication(data: {
    id: string;
    plan_id: string;
    application_id: string;
  }): Promise<PlanApplication> {
    const result = await db
      .insertInto("plan_applications")
      .values({
        id: data.id,
        plan_id: data.plan_id,
        application_id: data.application_id,
        created_at: new Date(),
      })
      .returningAll()
      .executeTakeFirstOrThrow();

    return {
      ...result,
      created_at: new Date(result.created_at),
    };
  }

  /**
   * Unlink application from plan
   */
  async unlinkApplication(planId: string, applicationId: string): Promise<boolean> {
    const result = await db
      .deleteFrom("plan_applications")
      .where("plan_id", "=", planId)
      .where("application_id", "=", applicationId)
      .executeTakeFirst();

    return (result.numDeletedRows ?? 0n) > 0n;
  }

  /**
   * Check if application is linked to plan
   */
  async hasApplication(planId: string, applicationId: string): Promise<boolean> {
    const result = await db
      .selectFrom("plan_applications")
      .select("id")
      .where("plan_id", "=", planId)
      .where("application_id", "=", applicationId)
      .executeTakeFirst();

    return !!result;
  }

  /**
   * Count applications linked to a plan
   */
  async countApplications(planId: string): Promise<number> {
    const result = await db
      .selectFrom("plan_applications")
      .select(db.fn.count("id").as("count"))
      .where("plan_id", "=", planId)
      .executeTakeFirst();

    return Number(result?.count ?? 0);
  }

  // ============================================
  // CREATE PLAN WITH VERSION (TRANSACTION)
  // ============================================

  /**
   * Create a plan and its first version atomically in a single transaction
   */
  async createPlanWithVersion(
    planData: PlanInsert,
    versionData: PlanVersionInsert
  ): Promise<{ plan: Plan; version: PlanVersion }> {
    return await db.transaction().execute(async (trx) => {
      // Create the plan
      const planResult = await trx
        .insertInto("plans")
        .values({
          id: planData.id,
          code: planData.code,
          name: planData.name,
          description: planData.description ?? null,
          plan_type: planData.plan_type ?? "SINGLE_APP",
          sort_order: planData.sort_order ?? 0,
          is_active: planData.is_active ?? true,
          is_public: planData.is_public ?? true,
          created_at: planData.created_at,
          updated_at: planData.updated_at,
        })
        .returningAll()
        .executeTakeFirstOrThrow();

      const plan: Plan = {
        ...planResult,
        plan_type: planResult.plan_type as PlanType,
        is_active: planResult.is_active as boolean,
        is_public: planResult.is_public as boolean,
        created_at: new Date(planResult.created_at),
        updated_at: new Date(planResult.updated_at),
      };

      // Create the first version
      const version = await this.createVersion(versionData, trx);

      return { plan, version };
    });
  }

  // ============================================
  // HELPER METHODS
  // ============================================

  private mapPlanVersion(result: Record<string, unknown>): PlanVersion {
    return {
      id: result.id as string,
      plan_id: result.plan_id as string,
      version: result.version as number,
      pricing_frequency: (result.pricing_frequency as PricingFrequency) ?? "BOTH",
      purchase_mode: (result.purchase_mode as PurchaseMode) ?? "PAID",
      price_monthly_inr: Number(result.price_monthly_inr),
      price_yearly_inr: Number(result.price_yearly_inr),
      discount_monthly_inr_type: result.discount_monthly_inr_type as DiscountType,
      discount_monthly_inr_value: Number(result.discount_monthly_inr_value),
      discount_yearly_inr_type: result.discount_yearly_inr_type as DiscountType,
      discount_yearly_inr_value: Number(result.discount_yearly_inr_value),
      price_monthly_usd: Number(result.price_monthly_usd),
      price_yearly_usd: Number(result.price_yearly_usd),
      discount_monthly_usd_type: result.discount_monthly_usd_type as DiscountType,
      discount_monthly_usd_value: Number(result.discount_monthly_usd_value),
      discount_yearly_usd_type: result.discount_yearly_usd_type as DiscountType,
      discount_yearly_usd_value: Number(result.discount_yearly_usd_value),
      price_two_yearly_inr: Number(result.price_two_yearly_inr ?? 0),
      price_two_yearly_usd: Number(result.price_two_yearly_usd ?? 0),
      discount_two_yearly_inr_type: (result.discount_two_yearly_inr_type as DiscountType) ?? "NONE",
      discount_two_yearly_inr_value: Number(result.discount_two_yearly_inr_value ?? 0),
      discount_two_yearly_usd_type: (result.discount_two_yearly_usd_type as DiscountType) ?? "NONE",
      discount_two_yearly_usd_value: Number(result.discount_two_yearly_usd_value ?? 0),
      is_active: result.is_active as boolean,
      published_at: result.published_at ? new Date(result.published_at as string) : null,
      retired_at: result.retired_at ? new Date(result.retired_at as string) : null,
      // Offer metadata
      is_offer: (result.is_offer as boolean) ?? false,
      offer_name: (result.offer_name as string) ?? null,
      offer_description: (result.offer_description as string) ?? null,
      offer_valid_from: result.offer_valid_from ? new Date(result.offer_valid_from as string) : null,
      offer_valid_to: result.offer_valid_to ? new Date(result.offer_valid_to as string) : null,
      created_at: new Date(result.created_at as string),
    };
  }

  /**
   * Check if plan has any active subscriptions
   */
  async hasActiveSubscriptions(planId: string): Promise<boolean> {
    const result = await db
      .selectFrom("subscriptions")
      .innerJoin("plan_versions", "plan_versions.id", "subscriptions.plan_version_id")
      .select("subscriptions.id")
      .where("plan_versions.plan_id", "=", planId)
      .where("subscriptions.status", "in", ["ACTIVE", "TRIALING"])
      .limit(1)
      .executeTakeFirst();

    return !!result;
  }
}

export default new PlanRepository();
