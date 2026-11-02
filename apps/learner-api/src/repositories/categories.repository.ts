/**
 * Categories repository - read-only for public web.
 * Returns active categories for a tenant.
 */

import { db } from "../db/connection";

export interface PublicCategoryRow {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  icon_url: string | null;
  parent_id: string | null;
  sort_order: number;
}

export async function listActiveCategories(tenantId: string): Promise<PublicCategoryRow[]> {
  const rows = await db
    .selectFrom("categories")
    .select(["id", "name", "slug", "description", "icon_url", "parent_id", "sort_order"])
    .where("tenant_id", "=", tenantId)
    .where("is_active", "=", true)
    .orderBy("sort_order", "asc")
    .orderBy("name", "asc")
    .execute();

  return rows as unknown as PublicCategoryRow[];
}

export async function findBySlug(
  tenantId: string,
  slug: string
): Promise<PublicCategoryRow | null> {
  const row = await db
    .selectFrom("categories")
    .select(["id", "name", "slug", "description", "icon_url", "parent_id", "sort_order"])
    .where("tenant_id", "=", tenantId)
    .where("slug", "=", slug)
    .where("is_active", "=", true)
    .executeTakeFirst();
  return (row as unknown as PublicCategoryRow) ?? null;
}
