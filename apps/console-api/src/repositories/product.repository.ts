import { db } from "../db/connection";
import { ConstraintType, UsageScopeType, UsageWindowType } from "../types/catalog.type";

// Define proper types for repository use
interface Product {
  id: string;
  feature_id: string;
  code: string;
  title: string | null;
  constraint_type: ConstraintType;
  unit: string | null;
  is_hard_limit: boolean;
  usage_scope: UsageScopeType;
  usage_window: UsageWindowType;
  created_at: Date;
}

interface ProductWithDetails extends Product {
  feature_key: string;
  feature_name: string | null;
  application_id: string;
  application_code: string;
  plan_version_count?: number;
}

interface ProductInsert {
  id: string;
  feature_id: string;
  code: string;
  title?: string | null;
  constraint_type: ConstraintType;
  unit?: string | null;
  is_hard_limit?: boolean;
  usage_scope?: UsageScopeType;
  usage_window?: UsageWindowType;
  created_at: Date;
}

interface ProductUpdate {
  title?: string | null;
  unit?: string | null;
  is_hard_limit?: boolean;
  usage_scope?: UsageScopeType;
  usage_window?: UsageWindowType;
}

class ProductRepository {
  /**
   * Find product by ID
   */
  async findById(id: string): Promise<Product | undefined> {
    const result = await db
      .selectFrom("products")
      .selectAll()
      .where("id", "=", id)
      .executeTakeFirst();

    if (!result) return undefined;

    return {
      ...result,
      constraint_type: result.constraint_type as ConstraintType,
      is_hard_limit: result.is_hard_limit as boolean,
      created_at: new Date(result.created_at),
    };
  }

  /**
   * Find product by ID with feature and application details (includes plan_version_count via LEFT JOIN)
   */
  async findByIdWithDetails(id: string): Promise<ProductWithDetails | undefined> {
    // Subquery to count plan versions per product
    const planVersionCountSubquery = db
      .selectFrom("plan_version_products")
      .select(["product_id"])
      .select(db.fn.count("id").as("plan_version_count"))
      .groupBy("product_id")
      .as("pvc");

    const result = await db
      .selectFrom("products")
      .innerJoin("features", "features.id", "products.feature_id")
      .innerJoin("applications", "applications.id", "features.application_id")
      .leftJoin(planVersionCountSubquery, "pvc.product_id", "products.id")
      .select([
        "products.id",
        "products.feature_id",
        "products.code",
        "products.title",
        "products.constraint_type",
        "products.unit",
        "products.is_hard_limit",
        "products.usage_scope",
        "products.usage_window",
        "products.created_at",
        "features.key as feature_key",
        "features.name as feature_name",
        "features.application_id",
        "applications.code as application_code",
        "pvc.plan_version_count",
      ])
      .where("products.id", "=", id)
      .executeTakeFirst();

    if (!result) return undefined;

    return {
      ...result,
      constraint_type: result.constraint_type as ConstraintType,
      is_hard_limit: result.is_hard_limit as boolean,
      created_at: new Date(result.created_at),
      plan_version_count: Number(result.plan_version_count ?? 0),
    };
  }

  /**
   * Find product by code
   */
  async findByCode(code: string): Promise<Product | undefined> {
    const result = await db
      .selectFrom("products")
      .selectAll()
      .where("code", "=", code)
      .executeTakeFirst();

    if (!result) return undefined;

    return {
      ...result,
      constraint_type: result.constraint_type as ConstraintType,
      is_hard_limit: result.is_hard_limit as boolean,
      created_at: new Date(result.created_at),
    };
  }

  /**
   * Find all products with optional filters (includes plan_version_count via LEFT JOIN)
   */
  async findAll(params?: {
    feature_id?: string;
    application_id?: string;
    constraint_type?: ConstraintType;
    is_hard_limit?: boolean;
    search?: string;
    limit?: number;
    offset?: number;
  }): Promise<ProductWithDetails[]> {
    // Subquery to count plan versions per product
    const planVersionCountSubquery = db
      .selectFrom("plan_version_products")
      .select(["product_id"])
      .select(db.fn.count("id").as("plan_version_count"))
      .groupBy("product_id")
      .as("pvc");

    let query = db
      .selectFrom("products")
      .innerJoin("features", "features.id", "products.feature_id")
      .innerJoin("applications", "applications.id", "features.application_id")
      .leftJoin(planVersionCountSubquery, "pvc.product_id", "products.id")
      .select([
        "products.id",
        "products.feature_id",
        "products.code",
        "products.title",
        "products.constraint_type",
        "products.unit",
        "products.is_hard_limit",
        "products.usage_scope",
        "products.usage_window",
        "products.created_at",
        "features.key as feature_key",
        "features.name as feature_name",
        "features.application_id",
        "applications.code as application_code",
        "pvc.plan_version_count",
      ]);

    if (params?.feature_id) {
      query = query.where("products.feature_id", "=", params.feature_id);
    }

    if (params?.application_id) {
      query = query.where("features.application_id", "=", params.application_id);
    }

    if (params?.constraint_type) {
      query = query.where("products.constraint_type", "=", params.constraint_type);
    }

    if (params?.is_hard_limit !== undefined) {
      query = query.where("products.is_hard_limit", "=", params.is_hard_limit);
    }

    if (params?.search) {
      query = query.where((eb) =>
        eb.or([
          eb("products.code", "ilike", `%${params.search}%`),
          eb("products.title", "ilike", `%${params.search}%`),
          eb("features.key", "ilike", `%${params.search}%`),
        ])
      );
    }

    query = query
      .orderBy("applications.name", "asc")
      .orderBy("features.key", "asc")
      .orderBy("products.code", "asc");

    if (params?.limit) {
      query = query.limit(params.limit);
    }

    if (params?.offset) {
      query = query.offset(params.offset);
    }

    const results = await query.execute();

    return results.map((r) => ({
      ...r,
      constraint_type: r.constraint_type as ConstraintType,
      is_hard_limit: r.is_hard_limit as boolean,
      created_at: new Date(r.created_at),
      plan_version_count: Number(r.plan_version_count ?? 0),
    }));
  }

  /**
   * Find products by feature ID
   */
  async findByFeatureId(featureId: string): Promise<Product[]> {
    const results = await db
      .selectFrom("products")
      .selectAll()
      .where("feature_id", "=", featureId)
      .orderBy("code", "asc")
      .execute();

    return results.map((r) => ({
      ...r,
      constraint_type: r.constraint_type as ConstraintType,
      is_hard_limit: r.is_hard_limit as boolean,
      created_at: new Date(r.created_at),
    }));
  }

  /**
   * Count products with optional filters
   */
  async count(params?: {
    feature_id?: string;
    application_id?: string;
    constraint_type?: ConstraintType;
    is_hard_limit?: boolean;
    search?: string;
  }): Promise<number> {
    let query = db
      .selectFrom("products")
      .innerJoin("features", "features.id", "products.feature_id")
      .select(db.fn.count("products.id").as("count"));

    if (params?.feature_id) {
      query = query.where("products.feature_id", "=", params.feature_id);
    }

    if (params?.application_id) {
      query = query.where("features.application_id", "=", params.application_id);
    }

    if (params?.constraint_type) {
      query = query.where("products.constraint_type", "=", params.constraint_type);
    }

    if (params?.is_hard_limit !== undefined) {
      query = query.where("products.is_hard_limit", "=", params.is_hard_limit);
    }

    if (params?.search) {
      query = query.where((eb) =>
        eb.or([
          eb("products.code", "ilike", `%${params.search}%`),
          eb("products.title", "ilike", `%${params.search}%`),
          eb("features.key", "ilike", `%${params.search}%`),
        ])
      );
    }

    const result = await query.executeTakeFirst();
    return Number(result?.count ?? 0);
  }

  /**
   * Create a new product
   */
  async create(data: ProductInsert): Promise<Product> {
    const result = await db
      .insertInto("products")
      .values({
        id: data.id,
        feature_id: data.feature_id,
        code: data.code,
        title: data.title ?? null,
        constraint_type: data.constraint_type,
        unit: data.unit ?? null,
        is_hard_limit: data.is_hard_limit ?? true,
        usage_scope: data.usage_scope ?? "TENANT",
        usage_window: data.usage_window ?? "LIFETIME",
        created_at: data.created_at,
      })
      .returningAll()
      .executeTakeFirstOrThrow();

    return {
      ...result,
      constraint_type: result.constraint_type as ConstraintType,
      is_hard_limit: result.is_hard_limit as boolean,
      created_at: new Date(result.created_at),
    };
  }

  /**
   * Update a product
   */
  async update(id: string, data: ProductUpdate): Promise<Product | undefined> {
    const updateData: Record<string, unknown> = {};

    if (data.title !== undefined) updateData.title = data.title;
    if (data.unit !== undefined) updateData.unit = data.unit;
    if (data.is_hard_limit !== undefined) updateData.is_hard_limit = data.is_hard_limit;
    if (data.usage_scope !== undefined) updateData.usage_scope = data.usage_scope;
    if (data.usage_window !== undefined) updateData.usage_window = data.usage_window;

    // Don't update if no fields provided
    if (Object.keys(updateData).length === 0) {
      return this.findById(id);
    }

    const result = await db
      .updateTable("products")
      .set(updateData)
      .where("id", "=", id)
      .returningAll()
      .executeTakeFirst();

    if (!result) return undefined;

    return {
      ...result,
      constraint_type: result.constraint_type as ConstraintType,
      is_hard_limit: result.is_hard_limit as boolean,
      created_at: new Date(result.created_at),
    };
  }

  /**
   * Check if code exists (for validation)
   */
  async codeExists(code: string, excludeId?: string): Promise<boolean> {
    let query = db
      .selectFrom("products")
      .select("id")
      .where("code", "=", code);

    if (excludeId) {
      query = query.where("id", "!=", excludeId);
    }

    const result = await query.executeTakeFirst();
    return !!result;
  }

  /**
   * Check if product is used in any plan versions
   */
  async isUsedInPlanVersions(productId: string): Promise<boolean> {
    const result = await db
      .selectFrom("plan_version_products")
      .select("id")
      .where("product_id", "=", productId)
      .limit(1)
      .executeTakeFirst();

    return !!result;
  }

  /**
   * Check if product is used in any addons
   */
  async isUsedInAddons(productId: string): Promise<boolean> {
    const result = await db
      .selectFrom("addons")
      .select("id")
      .where("product_id", "=", productId)
      .limit(1)
      .executeTakeFirst();

    return !!result;
  }

  /**
   * Get products by multiple IDs
   */
  async findByIds(ids: string[]): Promise<Product[]> {
    if (ids.length === 0) return [];

    const results = await db
      .selectFrom("products")
      .selectAll()
      .where("id", "in", ids)
      .execute();

    return results.map((r) => ({
      ...r,
      constraint_type: r.constraint_type as ConstraintType,
      is_hard_limit: r.is_hard_limit as boolean,
      created_at: new Date(r.created_at),
    }));
  }

}

export default new ProductRepository();
