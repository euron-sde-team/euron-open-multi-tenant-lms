import { BadRequestError } from "../errors/bad-request.error";
import { ConflictError } from "../errors/conflict-custom.error";
import { ForbiddenError } from "../errors/forbidden.error";
import { NotFoundError } from "../errors/not-found.error";
import categoriesRepository, {
  type CategoryRow,
  type CategoriesListParams,
} from "../repositories/categories.repository";
/* ------------------------------------------------------------------ */
/*  Response DTOs                                                      */
/* ------------------------------------------------------------------ */

export interface CategoryResponse {
  id: string;
  tenantId: string;
  name: string;
  slug: string;
  description: string | null;
  iconUrl: string | null;
  parentId: string | null;
  sortOrder: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CategoriesListResponse {
  categories: CategoryResponse[];
  total: number;
  page: number;
  limit: number;
}

/* ------------------------------------------------------------------ */
/*  Mappers                                                            */
/* ------------------------------------------------------------------ */

function toCategoryResponse(row: CategoryRow): CategoryResponse {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    name: row.name,
    slug: row.slug,
    description: row.description,
    iconUrl: row.icon_url,
    parentId: row.parent_id,
    sortOrder: Number(row.sort_order ?? 0),
    isActive: Boolean(row.is_active),
    createdAt: row.created_at instanceof Date ? row.created_at.toISOString() : String(row.created_at),
    updatedAt: row.updated_at instanceof Date ? row.updated_at.toISOString() : String(row.updated_at),
  };
}

/* ------------------------------------------------------------------ */
/*  Slug helpers                                                       */
/* ------------------------------------------------------------------ */

function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/* ------------------------------------------------------------------ */
/*  Service                                                            */
/* ------------------------------------------------------------------ */

class CategoriesService {
  async getCategories(
    tenantId: string,
    params: CategoriesListParams
  ): Promise<CategoriesListResponse> {
    const result = await categoriesRepository.findByTenantId(tenantId, params);
    return {
      ...result,
      categories: result.categories.map(toCategoryResponse),
    };
  }

  async getCategoryById(
    categoryId: string,
    tenantId: string
  ): Promise<CategoryResponse> {
    const row = await categoriesRepository.findById(categoryId);
    if (!row) throw new NotFoundError("Category not found");
    if (row.tenant_id !== tenantId) {
      throw new ForbiddenError("You do not have access to this category");
    }
    return toCategoryResponse(row);
  }

  async createCategory(
    tenantId: string,
    data: {
      name: string;
      slug?: string;
      description?: string | null;
      icon_url?: string | null;
      parent_id?: string | null;
      sort_order?: number;
      is_active?: boolean;
    }
  ): Promise<CategoryResponse> {
    if (!data.name?.trim()) {
      throw new BadRequestError("Category name is required");
    }

    const slug = data.slug?.trim() || generateSlug(data.name);
    if (!slug) {
      throw new BadRequestError("Could not generate a valid slug from the category name");
    }

    // Validate parent exists and belongs to tenant
    if (data.parent_id) {
      const parent = await categoriesRepository.findById(data.parent_id);
      if (!parent || parent.tenant_id !== tenantId) {
        throw new NotFoundError("Parent category not found");
      }
    }

    const slugExists = await categoriesRepository.slugExistsForTenant(tenantId, slug);
    if (slugExists) {
      throw new ConflictError(`Category with slug "${slug}" already exists`);
    }

    const row = await categoriesRepository.create({
      tenant_id: tenantId,
      name: data.name.trim(),
      slug,
      description: data.description,
      icon_url: data.icon_url,
      parent_id: data.parent_id,
      sort_order: data.sort_order,
      is_active: data.is_active,
    });


    return toCategoryResponse(row);
  }

  async updateCategory(
    categoryId: string,
    tenantId: string,
    data: {
      name?: string;
      slug?: string;
      description?: string | null;
      icon_url?: string | null;
      parent_id?: string | null;
      sort_order?: number;
      is_active?: boolean;
    }
  ): Promise<CategoryResponse> {
    const existing = await categoriesRepository.findById(categoryId);
    if (!existing) throw new NotFoundError("Category not found");
    if (existing.tenant_id !== tenantId) {
      throw new ForbiddenError("You do not have access to this category");
    }

    // Prevent circular parent reference
    if (data.parent_id === categoryId) {
      throw new BadRequestError("A category cannot be its own parent");
    }

    // Slug uniqueness check when slug is changing
    if (data.slug !== undefined && data.slug !== existing.slug) {
      const slugExists = await categoriesRepository.slugExistsForTenant(
        tenantId,
        data.slug,
        categoryId
      );
      if (slugExists) {
        throw new ConflictError(`Category with slug "${data.slug}" already exists`);
      }
    }

    // Validate parent if changing
    if (data.parent_id !== undefined && data.parent_id !== null) {
      const parent = await categoriesRepository.findById(data.parent_id);
      if (!parent || parent.tenant_id !== tenantId) {
        throw new NotFoundError("Parent category not found");
      }
    }

    const updated = await categoriesRepository.update(categoryId, data);
    if (!updated) throw new NotFoundError("Category not found");
    return toCategoryResponse(updated);
  }

  async deleteCategory(categoryId: string, tenantId: string): Promise<void> {
    const existing = await categoriesRepository.findById(categoryId);
    if (!existing) throw new NotFoundError("Category not found");
    if (existing.tenant_id !== tenantId) {
      throw new ForbiddenError("You do not have access to this category");
    }

    const deleted = await categoriesRepository.delete(categoryId);
    if (!deleted) throw new NotFoundError("Category not found");

  }
}

const categoriesService = new CategoriesService();
export default categoriesService;
