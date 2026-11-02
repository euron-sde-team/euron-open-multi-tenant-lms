import { db } from "../db/connection";

export interface TenantNavItemRow {
  id: string;
  tenant_id: string;
  item_type: string; // SYSTEM, FEATURE, CUSTOM
  feature_key: string | null;
  label: string;
  href: string;
  icon: string | null;
  sort_order: number;
  visible: boolean;
  is_external: boolean;
  badge_text: string | null;
  badge_variant: string | null;
}

class TenantNavItemsRepository {
  /**
   * Find all nav items for a tenant, ordered by sort_order
   */
  async findByTenantId(tenantId: string): Promise<TenantNavItemRow[]> {
    const rows = await db
      .selectFrom("tenant_nav_items")
      .selectAll()
      .where("tenant_id", "=", tenantId)
      .orderBy("sort_order", "asc")
      .execute();

    return rows.map((r) => ({
      ...r,
      visible: r.visible as boolean,
      is_external: r.is_external as boolean,
      sort_order: Number(r.sort_order ?? 0),
    }));
  }
}

const tenantNavItemsRepository = new TenantNavItemsRepository();
export default tenantNavItemsRepository;
