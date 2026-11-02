import { ulid } from "ulid";
import { db } from "../db/connection";
import type { categories } from "../db/types";

export type CategoryRow = categories;

export interface CategoriesListParams {
  page?: number;
  limit?: number;
  search?: string;
  parent_id?: string | null;
  is_active?: boolean;
}

export interface CategoriesListResult {
  categories: CategoryRow[];
  total: number;
  page: number;
  limit: number;
}

export interface CreateCategoryInput {
  tenant_id: string;
  name: string;
  slug: string;
  description?: string | null;
  icon_url?: string | null;
  parent_id?: string | null;
  sort_order?: number;
  is_active?: boolean;
}

export interface UpdateCategoryInput {
  name?: string;
  slug?: string;
  description?: string | null;
  icon_url?: string | null;
  parent_id?: string | null;
  sort_order?: number;
  is_active?: boolean;
}

class CategoriesRepository {
  async findByTenantId(
    tenantId: string,
    params: CategoriesListParams = {}
  ): Promise<CategoriesListResult> {
    const page = Math.max(1, params.page ?? 1);
    const limit = Math.min(100, Math.max(1, params.limit ?? 50));
    const offset = (page - 1) * limit;

    let countQuery = db
      .selectFrom("categories")
      .select(db.fn.count<number>("id").as("count"))
      .where("tenant_id", "=", tenantId);

    let listQuery = db
      .selectFrom("categories")
      .selectAll()
      .where("tenant_id", "=", tenantId);

    if (params.search) {
      const search = `%${params.search}%`;
      countQuery = countQuery.where((eb) =>
        eb.or([
          eb("name", "ilike", search),
          eb("slug", "ilike", search),
          eb("description", "ilike", search),
        ])
      );
      listQuery = listQuery.where((eb) =>
        eb.or([
          eb("name", "ilike", search),
          eb("slug", "ilike", search),
          eb("description", "ilike", search),
        ])
      );
    }

    if (params.parent_id !== undefined) {
      if (params.parent_id === null) {
        countQuery = countQuery.where("parent_id", "is", null);
        listQuery = listQuery.where("parent_id", "is", null);
      } else {
        countQuery = countQuery.where("parent_id", "=", params.parent_id);
        listQuery = listQuery.where("parent_id", "=", params.parent_id);
      }
    }

    if (params.is_active !== undefined) {
      countQuery = countQuery.where("is_active", "=", params.is_active);
      listQuery = listQuery.where("is_active", "=", params.is_active);
    }

    const countResult = await countQuery.executeTakeFirst();
    const total = Number(countResult?.count ?? 0);

    const rows = await listQuery
      .orderBy("sort_order", "asc")
      .orderBy("name", "asc")
      .limit(limit)
      .offset(offset)
      .execute();

    return {
      categories: rows as unknown as CategoryRow[],
      total,
      page,
      limit,
    };
  }

  async findById(id: string, tenantId?: string): Promise<CategoryRow | null> {
    let query = db
      .selectFrom("categories")
      .selectAll()
      .where("id", "=", id);

    if (tenantId) {
      query = query.where("tenant_id", "=", tenantId);
    }

    const row = await query.executeTakeFirst();
    return row as unknown as CategoryRow | null;
  }

  async findBySlug(tenantId: string, slug: string): Promise<CategoryRow | null> {
    const row = await db
      .selectFrom("categories")
      .selectAll()
      .where("tenant_id", "=", tenantId)
      .where("slug", "=", slug)
      .executeTakeFirst();
    return row as unknown as CategoryRow | null;
  }

  async slugExistsForTenant(
    tenantId: string,
    slug: string,
    excludeId?: string
  ): Promise<boolean> {
    let query = db
      .selectFrom("categories")
      .select("id")
      .where("tenant_id", "=", tenantId)
      .where("slug", "=", slug);
    if (excludeId) {
      query = query.where("id", "!=", excludeId);
    }
    const result = await query.executeTakeFirst();
    return !!result;
  }

  async create(data: CreateCategoryInput): Promise<CategoryRow> {
    const id = ulid();
    const now = new Date();
    const row = await db
      .insertInto("categories")
      .values({
        id,
        tenant_id: data.tenant_id,
        name: data.name,
        slug: data.slug,
        description: data.description ?? null,
        icon_url: data.icon_url ?? null,
        parent_id: data.parent_id ?? null,
        sort_order: data.sort_order ?? 0,
        is_active: data.is_active ?? true,
        created_at: now,
        updated_at: now,
      })
      .returningAll()
      .executeTakeFirstOrThrow();
    return row as unknown as CategoryRow;
  }

  async update(id: string, data: UpdateCategoryInput, tenantId?: string): Promise<CategoryRow | null> {
    const now = new Date();
    const updateData: Record<string, unknown> = { updated_at: now };
    if (data.name !== undefined) updateData.name = data.name;
    if (data.slug !== undefined) updateData.slug = data.slug;
    if (data.description !== undefined) updateData.description = data.description;
    if (data.icon_url !== undefined) updateData.icon_url = data.icon_url;
    if (data.parent_id !== undefined) updateData.parent_id = data.parent_id;
    if (data.sort_order !== undefined) updateData.sort_order = data.sort_order;
    if (data.is_active !== undefined) updateData.is_active = data.is_active;

    let query = db
      .updateTable("categories")
      .set(updateData)
      .where("id", "=", id);

    if (tenantId) {
      query = query.where("tenant_id", "=", tenantId);
    }

    const row = await query
      .returningAll()
      .executeTakeFirst();
    return row as unknown as CategoryRow | null;
  }

  async delete(id: string, tenantId?: string): Promise<boolean> {
    let query = db
      .deleteFrom("categories")
      .where("id", "=", id);

    if (tenantId) {
      query = query.where("tenant_id", "=", tenantId);
    }

    const result = await query.executeTakeFirst();
    return Number(result?.numDeletedRows ?? 0) > 0;
  }
}

const categoriesRepository = new CategoriesRepository();
export default categoriesRepository;
