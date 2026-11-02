import { db } from "../db/connection";

// Define proper types for repository use
interface Feature {
  id: string;
  application_id: string;
  key: string;
  name: string | null;
  description: string | null;
  category: string | null;
  is_deprecated: boolean;
  sort_order: number;
  is_navigable: boolean;
  nav_route: string | null;
  nav_label: string | null;
  nav_icon: string | null;
  nav_sort_order: number;
  created_at: Date;
}

interface FeatureWithApplication extends Feature {
  application_code: string;
  application_name: string;
}

interface FeatureInsert {
  id: string;
  application_id: string;
  key: string;
  name?: string | null;
  description?: string | null;
  category?: string | null;
  is_deprecated?: boolean;
  sort_order?: number;
  is_navigable?: boolean;
  nav_route?: string | null;
  nav_label?: string | null;
  nav_icon?: string | null;
  nav_sort_order?: number;
  created_at: Date;
}

interface FeatureUpdate {
  name?: string | null;
  description?: string | null;
  category?: string | null;
  sort_order?: number;
  is_deprecated?: boolean;
  is_navigable?: boolean;
  nav_route?: string | null;
  nav_label?: string | null;
  nav_icon?: string | null;
  nav_sort_order?: number;
}

class FeatureRepository {
  /**
   * Find feature by ID
   */
  async findById(id: string): Promise<Feature | undefined> {
    const result = await db
      .selectFrom("features")
      .selectAll()
      .where("id", "=", id)
      .executeTakeFirst();

    if (!result) return undefined;

    return {
      ...result,
      is_deprecated: result.is_deprecated as boolean,
      is_navigable: result.is_navigable as boolean,
      nav_sort_order: Number(result.nav_sort_order ?? 0),
      created_at: new Date(result.created_at),
    };
  }

  /**
   * Find feature by ID with application details
   */
  async findByIdWithApplication(id: string): Promise<FeatureWithApplication | undefined> {
    const result = await db
      .selectFrom("features")
      .innerJoin("applications", "applications.id", "features.application_id")
      .select([
        "features.id",
        "features.application_id",
        "features.key",
        "features.name",
        "features.description",
        "features.category",
        "features.is_deprecated",
        "features.sort_order",
        "features.is_navigable",
        "features.nav_route",
        "features.nav_label",
        "features.nav_icon",
        "features.nav_sort_order",
        "features.created_at",
        "applications.code as application_code",
        "applications.name as application_name",
      ])
      .where("features.id", "=", id)
      .executeTakeFirst();

    if (!result) return undefined;

    return {
      ...result,
      is_deprecated: result.is_deprecated as boolean,
      is_navigable: result.is_navigable as boolean,
      nav_sort_order: Number(result.nav_sort_order ?? 0),
      created_at: new Date(result.created_at),
    };
  }

  /**
   * Find feature by key
   */
  async findByKey(key: string): Promise<Feature | undefined> {
    const result = await db
      .selectFrom("features")
      .selectAll()
      .where("key", "=", key)
      .executeTakeFirst();

    if (!result) return undefined;

    return {
      ...result,
      is_deprecated: result.is_deprecated as boolean,
      is_navigable: result.is_navigable as boolean,
      nav_sort_order: Number(result.nav_sort_order ?? 0),
      created_at: new Date(result.created_at),
    };
  }

  /**
   * Find all features with optional filters
   */
  async findAll(params?: {
    application_id?: string;
    category?: string;
    is_deprecated?: boolean;
    search?: string;
    limit?: number;
    offset?: number;
  }): Promise<FeatureWithApplication[]> {
    let query = db
      .selectFrom("features")
      .innerJoin("applications", "applications.id", "features.application_id")
      .select([
        "features.id",
        "features.application_id",
        "features.key",
        "features.name",
        "features.description",
        "features.category",
        "features.is_deprecated",
        "features.sort_order",
        "features.is_navigable",
        "features.nav_route",
        "features.nav_label",
        "features.nav_icon",
        "features.nav_sort_order",
        "features.created_at",
        "applications.code as application_code",
        "applications.name as application_name",
      ]);

    if (params?.application_id) {
      query = query.where("features.application_id", "=", params.application_id);
    }

    if (params?.category) {
      query = query.where("features.category", "=", params.category);
    }

    if (params?.is_deprecated !== undefined) {
      query = query.where("features.is_deprecated", "=", params.is_deprecated);
    }

    if (params?.search) {
      query = query.where((eb) =>
        eb.or([
          eb("features.key", "ilike", `%${params.search}%`),
          eb("features.name", "ilike", `%${params.search}%`),
          eb("features.category", "ilike", `%${params.search}%`),
        ])
      );
    }

    query = query
      .orderBy("applications.name", "asc")
      .orderBy("features.sort_order", "asc")
      .orderBy("features.key", "asc");

    if (params?.limit) {
      query = query.limit(params.limit);
    }

    if (params?.offset) {
      query = query.offset(params.offset);
    }

    const results = await query.execute();

    return results.map((r) => ({
      ...r,
      is_deprecated: r.is_deprecated as boolean,
      is_navigable: r.is_navigable as boolean,
      nav_sort_order: Number(r.nav_sort_order ?? 0),
      created_at: new Date(r.created_at),
    }));
  }

  /**
   * Find features by application ID
   */
  async findByApplicationId(applicationId: string): Promise<Feature[]> {
    const results = await db
      .selectFrom("features")
      .selectAll()
      .where("application_id", "=", applicationId)
      .orderBy("sort_order", "asc")
      .orderBy("key", "asc")
      .execute();

    return results.map((r) => ({
      ...r,
      is_deprecated: r.is_deprecated as boolean,
      is_navigable: r.is_navigable as boolean,
      nav_sort_order: Number(r.nav_sort_order ?? 0),
      created_at: new Date(r.created_at),
    }));
  }

  /**
   * Count features with optional filters
   */
  async count(params?: {
    application_id?: string;
    category?: string;
    is_deprecated?: boolean;
    search?: string;
  }): Promise<number> {
    let query = db
      .selectFrom("features")
      .select(db.fn.count("id").as("count"));

    if (params?.application_id) {
      query = query.where("application_id", "=", params.application_id);
    }

    if (params?.category) {
      query = query.where("category", "=", params.category);
    }

    if (params?.is_deprecated !== undefined) {
      query = query.where("is_deprecated", "=", params.is_deprecated);
    }

    if (params?.search) {
      query = query.where((eb) =>
        eb.or([
          eb("key", "ilike", `%${params.search}%`),
          eb("name", "ilike", `%${params.search}%`),
          eb("category", "ilike", `%${params.search}%`),
        ])
      );
    }

    const result = await query.executeTakeFirst();
    return Number(result?.count ?? 0);
  }

  /**
   * Create a new feature
   */
  async create(data: FeatureInsert): Promise<Feature> {
    const result = await db
      .insertInto("features")
      .values({
        id: data.id,
        application_id: data.application_id,
        key: data.key,
        name: data.name ?? null,
        description: data.description ?? null,
        category: data.category ?? null,
        is_deprecated: data.is_deprecated ?? false,
        sort_order: data.sort_order ?? 0,
        is_navigable: data.is_navigable ?? false,
        nav_route: data.nav_route ?? null,
        nav_label: data.nav_label ?? null,
        nav_icon: data.nav_icon ?? null,
        nav_sort_order: data.nav_sort_order ?? 0,
        created_at: data.created_at,
      })
      .returningAll()
      .executeTakeFirstOrThrow();

    return {
      ...result,
      is_deprecated: result.is_deprecated as boolean,
      is_navigable: result.is_navigable as boolean,
      nav_sort_order: Number(result.nav_sort_order ?? 0),
      created_at: new Date(result.created_at),
    };
  }

  /**
   * Update a feature
   */
  async update(id: string, data: FeatureUpdate): Promise<Feature | undefined> {
    const updateData: Record<string, unknown> = {};

    if (data.name !== undefined) updateData.name = data.name;
    if (data.description !== undefined) updateData.description = data.description;
    if (data.category !== undefined) updateData.category = data.category;
    if (data.sort_order !== undefined) updateData.sort_order = data.sort_order;
    if (data.is_deprecated !== undefined) updateData.is_deprecated = data.is_deprecated;
    if (data.is_navigable !== undefined) updateData.is_navigable = data.is_navigable;
    if (data.nav_route !== undefined) updateData.nav_route = data.nav_route;
    if (data.nav_label !== undefined) updateData.nav_label = data.nav_label;
    if (data.nav_icon !== undefined) updateData.nav_icon = data.nav_icon;
    if (data.nav_sort_order !== undefined) updateData.nav_sort_order = data.nav_sort_order;

    // Don't update if no fields provided
    if (Object.keys(updateData).length === 0) {
      return this.findById(id);
    }

    const result = await db
      .updateTable("features")
      .set(updateData)
      .where("id", "=", id)
      .returningAll()
      .executeTakeFirst();

    if (!result) return undefined;

    return {
      ...result,
      is_deprecated: result.is_deprecated as boolean,
      is_navigable: result.is_navigable as boolean,
      nav_sort_order: Number(result.nav_sort_order ?? 0),
      created_at: new Date(result.created_at),
    };
  }

  /**
   * Deprecate a feature (never hard delete)
   */
  async deprecate(id: string): Promise<boolean> {
    const result = await db
      .updateTable("features")
      .set({ is_deprecated: true })
      .where("id", "=", id)
      .executeTakeFirst();

    return (result.numUpdatedRows ?? 0n) > 0n;
  }

  /**
   * Check if key exists (for validation)
   */
  async keyExists(key: string, excludeId?: string): Promise<boolean> {
    let query = db
      .selectFrom("features")
      .select("id")
      .where("key", "=", key);

    if (excludeId) {
      query = query.where("id", "!=", excludeId);
    }

    const result = await query.executeTakeFirst();
    return !!result;
  }

  /**
   * Count products for a feature
   */
  async countProducts(featureId: string): Promise<number> {
    const result = await db
      .selectFrom("products")
      .select(db.fn.count("id").as("count"))
      .where("feature_id", "=", featureId)
      .executeTakeFirst();

    return Number(result?.count ?? 0);
  }

  /**
   * Get all unique categories
   */
  async getCategories(): Promise<string[]> {
    const results = await db
      .selectFrom("features")
      .select("category")
      .where("category", "is not", null)
      .distinct()
      .orderBy("category", "asc")
      .execute();

    return results.map((r) => r.category as string);
  }
}

export default new FeatureRepository();
