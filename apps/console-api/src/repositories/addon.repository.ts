import { ulid } from "ulid";
import { db } from "../db/connection";
import {
  AddonCatalogQueryParams,
  CreateAddonRequest,
  UpdateAddonRequest,
} from "../types/tenant.type";

// ============================================
// TYPES
// ============================================

interface Addon {
  id: string;
  application_id: string;
  product_id: string;
  code: string;
  name: string;
  description: string | null;
  grant_value: number;
  is_unlimited: boolean;
  price_monthly_inr: number;
  price_yearly_inr: number;
  price_monthly_usd: number;
  price_yearly_usd: number;
  is_active: boolean;
  is_public: boolean;
  sort_order: number;
  created_at: Date;
  updated_at: Date;
}

interface AddonWithDetails extends Addon {
  application_code: string;
  application_name: string;
  product_code: string;
  product_constraint_type: string;
  feature_key: string;
}

// ============================================
// REPOSITORY
// ============================================

class AddonRepository {
  /**
   * Find addon by ID
   */
  async findById(id: string): Promise<Addon | null> {
    const addon = await db
      .selectFrom("addons")
      .selectAll()
      .where("id", "=", id)
      .executeTakeFirst();

    return addon ? this.mapToAddon(addon) : null;
  }

  /**
   * Find addon by ID with application and product details
   */
  async findByIdWithDetails(id: string): Promise<AddonWithDetails | null> {
    const result = await db
      .selectFrom("addons")
      .innerJoin("applications", "addons.application_id", "applications.id")
      .innerJoin("products", "addons.product_id", "products.id")
      .innerJoin("features", "products.feature_id", "features.id")
      .select([
        "addons.id",
        "addons.application_id",
        "addons.product_id",
        "addons.code",
        "addons.name",
        "addons.description",
        "addons.grant_value",
        "addons.is_unlimited",
        "addons.price_monthly_inr",
        "addons.price_yearly_inr",
        "addons.price_monthly_usd",
        "addons.price_yearly_usd",
        "addons.is_active",
        "addons.is_public",
        "addons.sort_order",
        "addons.created_at",
        "addons.updated_at",
        "applications.code as application_code",
        "applications.name as application_name",
        "products.code as product_code",
        "products.constraint_type as product_constraint_type",
        "features.key as feature_key",
      ])
      .where("addons.id", "=", id)
      .executeTakeFirst();

    return result ? this.mapToAddonWithDetails(result) : null;
  }

  /**
   * Find addon by code
   */
  async findByCode(code: string): Promise<Addon | null> {
    const addon = await db
      .selectFrom("addons")
      .selectAll()
      .where("code", "=", code)
      .executeTakeFirst();

    return addon ? this.mapToAddon(addon) : null;
  }

  /**
   * List addons (catalog) with filters
   */
  async findAll(params: AddonCatalogQueryParams): Promise<{ addons: AddonWithDetails[]; total: number }> {
    const page = params.page || 1;
    const limit = params.limit || 50;
    const offset = (page - 1) * limit;

    let query = db
      .selectFrom("addons")
      .innerJoin("applications", "addons.application_id", "applications.id")
      .innerJoin("products", "addons.product_id", "products.id")
      .innerJoin("features", "products.feature_id", "features.id");

    let countQuery = db
      .selectFrom("addons")
      .select(db.fn.countAll().as("count"));

    // Apply filters
    if (params.application_id) {
      query = query.where("addons.application_id", "=", params.application_id);
      countQuery = countQuery.where("application_id", "=", params.application_id);
    }

    if (params.product_id) {
      query = query.where("addons.product_id", "=", params.product_id);
      countQuery = countQuery.where("product_id", "=", params.product_id);
    }

    if (params.is_active !== undefined) {
      query = query.where("addons.is_active", "=", params.is_active);
      countQuery = countQuery.where("is_active", "=", params.is_active);
    }

    if (params.is_public !== undefined) {
      query = query.where("addons.is_public", "=", params.is_public);
      countQuery = countQuery.where("is_public", "=", params.is_public);
    }

    if (params.search) {
      const searchPattern = `%${params.search}%`;
      query = query.where((eb) =>
        eb.or([
          eb("addons.name", "ilike", searchPattern),
          eb("addons.code", "ilike", searchPattern),
          eb("addons.description", "ilike", searchPattern),
        ])
      );
      countQuery = countQuery.where((eb) =>
        eb.or([
          eb("name", "ilike", searchPattern),
          eb("code", "ilike", searchPattern),
          eb("description", "ilike", searchPattern),
        ])
      );
    }

    // Execute queries
    const [addons, countResult] = await Promise.all([
      query
        .select([
          "addons.id",
          "addons.application_id",
          "addons.product_id",
          "addons.code",
          "addons.name",
          "addons.description",
          "addons.grant_value",
          "addons.is_unlimited",
          "addons.price_monthly_inr",
          "addons.price_yearly_inr",
          "addons.price_monthly_usd",
          "addons.price_yearly_usd",
          "addons.is_active",
          "addons.is_public",
          "addons.sort_order",
          "addons.created_at",
          "addons.updated_at",
          "applications.code as application_code",
          "applications.name as application_name",
          "products.code as product_code",
          "products.constraint_type as product_constraint_type",
          "features.key as feature_key",
        ])
        .orderBy("addons.sort_order", "asc")
        .orderBy("addons.name", "asc")
        .limit(limit)
        .offset(offset)
        .execute(),
      countQuery.executeTakeFirst(),
    ]);

    return {
      addons: addons.map((a) => this.mapToAddonWithDetails(a)),
      total: Number(countResult?.count || 0),
    };
  }

  /**
   * Create addon
   */
  async create(data: CreateAddonRequest): Promise<Addon> {
    const now = new Date();
    const id = ulid();

    const result = await db
      .insertInto("addons")
      .values({
        id,
        application_id: data.application_id,
        code: data.code,
        name: data.name,
        description: data.description ?? null,
        product_id: data.product_id,
        grant_value: data.grant_value,
        is_unlimited: data.is_unlimited ?? false,
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
        is_active: data.is_active ?? true,
        is_public: data.is_public ?? true,
        sort_order: data.sort_order ?? 0,
        created_at: now,
        updated_at: now,
      })
      .returningAll()
      .executeTakeFirstOrThrow();

    return this.mapToAddon(result as Record<string, unknown>);
  }

  /**
   * Update addon
   */
  async update(id: string, data: UpdateAddonRequest): Promise<Addon | null> {
    const updateFields: Record<string, unknown> = {
      updated_at: new Date(),
    };

    if (data.name !== undefined) updateFields.name = data.name;
    if (data.description !== undefined) updateFields.description = data.description;
    if (data.grant_value !== undefined) updateFields.grant_value = data.grant_value;
    if (data.is_unlimited !== undefined) updateFields.is_unlimited = data.is_unlimited;
    if (data.price_monthly_inr !== undefined)
      updateFields.price_monthly_inr = String(data.price_monthly_inr);
    if (data.price_yearly_inr !== undefined)
      updateFields.price_yearly_inr = String(data.price_yearly_inr);
    if (data.price_monthly_usd !== undefined)
      updateFields.price_monthly_usd = String(data.price_monthly_usd);
    if (data.price_yearly_usd !== undefined)
      updateFields.price_yearly_usd = String(data.price_yearly_usd);
    if (data.discount_monthly_inr_type !== undefined)
      updateFields.discount_monthly_inr_type = data.discount_monthly_inr_type;
    if (data.discount_monthly_inr_value !== undefined)
      updateFields.discount_monthly_inr_value = String(data.discount_monthly_inr_value);
    if (data.discount_yearly_inr_type !== undefined)
      updateFields.discount_yearly_inr_type = data.discount_yearly_inr_type;
    if (data.discount_yearly_inr_value !== undefined)
      updateFields.discount_yearly_inr_value = String(data.discount_yearly_inr_value);
    if (data.discount_monthly_usd_type !== undefined)
      updateFields.discount_monthly_usd_type = data.discount_monthly_usd_type;
    if (data.discount_monthly_usd_value !== undefined)
      updateFields.discount_monthly_usd_value = String(data.discount_monthly_usd_value);
    if (data.discount_yearly_usd_type !== undefined)
      updateFields.discount_yearly_usd_type = data.discount_yearly_usd_type;
    if (data.discount_yearly_usd_value !== undefined)
      updateFields.discount_yearly_usd_value = String(data.discount_yearly_usd_value);
    if (data.is_active !== undefined) updateFields.is_active = data.is_active;
    if (data.is_public !== undefined) updateFields.is_public = data.is_public;
    if (data.sort_order !== undefined) updateFields.sort_order = data.sort_order;

    const result = await db
      .updateTable("addons")
      .set(updateFields as Record<string, never>)
      .where("id", "=", id)
      .returningAll()
      .executeTakeFirst();

    return result ? this.mapToAddon(result as Record<string, unknown>) : null;
  }

  /**
   * Get addon product details (for entitlement creation)
   */
  async getAddonProductDetails(addonId: string): Promise<{
    product_id: string;
    product_code: string;
    product_constraint_type: string;
    feature_key: string;
    application_code: string;
    grant_value: number;
    is_unlimited: boolean;
  } | null> {
    const result = await db
      .selectFrom("addons")
      .innerJoin("products", "addons.product_id", "products.id")
      .innerJoin("features", "products.feature_id", "features.id")
      .innerJoin("applications", "features.application_id", "applications.id")
      .select([
        "products.id as product_id",
        "products.code as product_code",
        "products.constraint_type as product_constraint_type",
        "features.key as feature_key",
        "applications.code as application_code",
        "addons.grant_value",
        "addons.is_unlimited",
      ])
      .where("addons.id", "=", addonId)
      .executeTakeFirst();

    if (!result) return null;

    return {
      product_id: result.product_id,
      product_code: result.product_code,
      product_constraint_type: result.product_constraint_type,
      feature_key: result.feature_key,
      application_code: result.application_code,
      grant_value: result.grant_value,
      is_unlimited: result.is_unlimited,
    };
  }

  // ============================================
  // PRIVATE HELPERS
  // ============================================

  private mapToAddon(row: Record<string, unknown>): Addon {
    return {
      id: row.id as string,
      application_id: row.application_id as string,
      product_id: row.product_id as string,
      code: row.code as string,
      name: row.name as string,
      description: row.description as string | null,
      grant_value: Number(row.grant_value),
      is_unlimited: row.is_unlimited as boolean,
      price_monthly_inr: Number(row.price_monthly_inr),
      price_yearly_inr: Number(row.price_yearly_inr),
      price_monthly_usd: Number(row.price_monthly_usd),
      price_yearly_usd: Number(row.price_yearly_usd),
      is_active: row.is_active as boolean,
      is_public: row.is_public as boolean,
      sort_order: row.sort_order as number,
      created_at: row.created_at as Date,
      updated_at: row.updated_at as Date,
    };
  }

  private mapToAddonWithDetails(row: Record<string, unknown>): AddonWithDetails {
    return {
      ...this.mapToAddon(row),
      application_code: row.application_code as string,
      application_name: row.application_name as string,
      product_code: row.product_code as string,
      product_constraint_type: row.product_constraint_type as string,
      feature_key: row.feature_key as string,
    };
  }
}

export default new AddonRepository();
