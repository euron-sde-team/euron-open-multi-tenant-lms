import { db } from "../db/connection";

// Define proper types for repository use
interface Application {
  id: string;
  code: string;
  name: string;
  description: string | null;
  icon_url: string | null;
  config: Record<string, unknown> | null;
  is_active: boolean;
  is_public: boolean;
  sort_order: number;
  created_at: Date;
  updated_at: Date;
}

interface ApplicationInsert {
  id: string;
  code: string;
  name: string;
  description?: string | null;
  icon_url?: string | null;
  config?: Record<string, unknown> | null;
  is_active?: boolean;
  is_public?: boolean;
  sort_order?: number;
  created_at: Date;
  updated_at: Date;
}

interface ApplicationUpdate {
  name?: string;
  description?: string | null;
  icon_url?: string | null;
  config?: Record<string, unknown> | null;
  is_active?: boolean;
  is_public?: boolean;
  sort_order?: number;
  updated_at?: Date;
}

class ApplicationRepository {
  /**
   * Find application by ID
   */
  async findById(id: string): Promise<Application | undefined> {
    const result = await db
      .selectFrom("applications")
      .selectAll()
      .where("id", "=", id)
      .executeTakeFirst();

    if (!result) return undefined;

    return {
      ...result,
      config: (result.config as Record<string, unknown> | null) ?? null,
      is_active: result.is_active as boolean,
      is_public: result.is_public as boolean,
      created_at: new Date(result.created_at),
      updated_at: new Date(result.updated_at),
    };
  }

  /**
   * Find application by code
   */
  async findByCode(code: string): Promise<Application | undefined> {
    const result = await db
      .selectFrom("applications")
      .selectAll()
      .where("code", "=", code)
      .executeTakeFirst();

    if (!result) return undefined;

    return {
      ...result,
      config: (result.config as Record<string, unknown> | null) ?? null,
      is_active: result.is_active as boolean,
      is_public: result.is_public as boolean,
      created_at: new Date(result.created_at),
      updated_at: new Date(result.updated_at),
    };
  }

  /**
   * Find all applications with optional filters
   */
  async findAll(params?: {
    is_active?: boolean;
    is_public?: boolean;
    search?: string;
    limit?: number;
    offset?: number;
  }): Promise<Application[]> {
    let query = db.selectFrom("applications").selectAll();

    if (params?.is_active !== undefined) {
      query = query.where("is_active", "=", params.is_active);
    }

    if (params?.is_public !== undefined) {
      query = query.where("is_public", "=", params.is_public);
    }

    if (params?.search) {
      query = query.where((eb) =>
        eb.or([
          eb("name", "ilike", `%${params.search}%`),
          eb("code", "ilike", `%${params.search}%`),
        ])
      );
    }

    query = query.orderBy("sort_order", "asc").orderBy("name", "asc");

    if (params?.limit) {
      query = query.limit(params.limit);
    }

    if (params?.offset) {
      query = query.offset(params.offset);
    }

    const results = await query.execute();

    return results.map((r) => ({
      ...r,
      config: (r.config as Record<string, unknown> | null) ?? null,
      is_active: r.is_active as boolean,
      is_public: r.is_public as boolean,
      created_at: new Date(r.created_at),
      updated_at: new Date(r.updated_at),
    }));
  }

  /**
   * Count applications with optional filters
   */
  async count(params?: {
    is_active?: boolean;
    is_public?: boolean;
    search?: string;
  }): Promise<number> {
    let query = db
      .selectFrom("applications")
      .select(db.fn.count("id").as("count"));

    if (params?.is_active !== undefined) {
      query = query.where("is_active", "=", params.is_active);
    }

    if (params?.is_public !== undefined) {
      query = query.where("is_public", "=", params.is_public);
    }

    if (params?.search) {
      query = query.where((eb) =>
        eb.or([
          eb("name", "ilike", `%${params.search}%`),
          eb("code", "ilike", `%${params.search}%`),
        ])
      );
    }

    const result = await query.executeTakeFirst();
    return Number(result?.count ?? 0);
  }

  /**
   * Create a new application
   */
  async create(data: ApplicationInsert): Promise<Application> {
    const result = await db
      .insertInto("applications")
      .values({
        id: data.id,
        code: data.code,
        name: data.name,
        description: data.description ?? null,
        icon_url: data.icon_url ?? null,
        config: data.config ?? null,
        is_active: data.is_active ?? true,
        is_public: data.is_public ?? true,
        sort_order: data.sort_order ?? 0,
        created_at: data.created_at,
        updated_at: data.updated_at,
      })
      .returningAll()
      .executeTakeFirstOrThrow();

    return {
      ...result,
      config: (result.config as Record<string, unknown> | null) ?? null,
      is_active: result.is_active as boolean,
      is_public: result.is_public as boolean,
      created_at: new Date(result.created_at),
      updated_at: new Date(result.updated_at),
    };
  }

  /**
   * Update an application
   */
  async update(id: string, data: ApplicationUpdate): Promise<Application | undefined> {
    const updateData: Record<string, unknown> = {
      updated_at: new Date(),
    };

    if (data.name !== undefined) updateData.name = data.name;
    if (data.description !== undefined) updateData.description = data.description;
    if (data.icon_url !== undefined) updateData.icon_url = data.icon_url;
    if (data.config !== undefined) updateData.config = data.config;
    if (data.is_active !== undefined) updateData.is_active = data.is_active;
    if (data.is_public !== undefined) updateData.is_public = data.is_public;
    if (data.sort_order !== undefined) updateData.sort_order = data.sort_order;

    const result = await db
      .updateTable("applications")
      .set(updateData)
      .where("id", "=", id)
      .returningAll()
      .executeTakeFirst();

    if (!result) return undefined;

    return {
      ...result,
      config: (result.config as Record<string, unknown> | null) ?? null,
      is_active: result.is_active as boolean,
      is_public: result.is_public as boolean,
      created_at: new Date(result.created_at),
      updated_at: new Date(result.updated_at),
    };
  }

  /**
   * Soft delete (deactivate) an application
   */
  async deactivate(id: string): Promise<boolean> {
    const result = await db
      .updateTable("applications")
      .set({
        is_active: false,
        updated_at: new Date(),
      })
      .where("id", "=", id)
      .executeTakeFirst();

    return (result.numUpdatedRows ?? 0n) > 0n;
  }

  /**
   * Hard delete an application (use with caution)
   */
  async delete(id: string): Promise<boolean> {
    const result = await db
      .deleteFrom("applications")
      .where("id", "=", id)
      .executeTakeFirst();

    return (result.numDeletedRows ?? 0n) > 0n;
  }

  /**
   * Check if code exists (for validation)
   */
  async codeExists(code: string, excludeId?: string): Promise<boolean> {
    let query = db
      .selectFrom("applications")
      .select("id")
      .where("code", "=", code);

    if (excludeId) {
      query = query.where("id", "!=", excludeId);
    }

    const result = await query.executeTakeFirst();
    return !!result;
  }

  /**
   * Count features for an application
   */
  async countFeatures(applicationId: string): Promise<number> {
    const result = await db
      .selectFrom("features")
      .select(db.fn.count("id").as("count"))
      .where("application_id", "=", applicationId)
      .executeTakeFirst();

    return Number(result?.count ?? 0);
  }

  /**
   * Get application with feature count
   */
  async findByIdWithFeatureCount(id: string): Promise<(Application & { feature_count: number }) | undefined> {
    const app = await this.findById(id);
    if (!app) return undefined;

    const featureCount = await this.countFeatures(id);
    return { ...app, feature_count: featureCount };
  }
}

export default new ApplicationRepository();
