import { db } from "../db/connection";

export interface FeatureRow {
  id: string;
  application_id: string;
  key: string;
  name: string | null;
  description: string | null;
  category: string | null;
  is_deprecated: boolean;
  sort_order: number;
}

export interface NavigableFeatureRow {
  key: string;
  nav_route: string;
  nav_label: string;
  nav_icon: string | null;
  nav_sort_order: number;
}

export interface FeatureWithProductsRow extends FeatureRow {
  product_id: string | null;
  product_code: string | null;
  product_constraint_type: string | null;
  product_unit: string | null;
}

class FeaturesRepository {
  /**
   * Find all non-deprecated features for the given application IDs,
   * joined with their products to get constraint_type, unit, and code.
   */
  async findByApplicationIdsWithProducts(
    applicationIds: string[]
  ): Promise<FeatureWithProductsRow[]> {
    if (applicationIds.length === 0) return [];

    const rows = await db
      .selectFrom("features as f")
      .leftJoin("products as p", "p.feature_id", "f.id")
      .select([
        "f.id",
        "f.application_id",
        "f.key",
        "f.name",
        "f.description",
        "f.category",
        "f.is_deprecated",
        "f.sort_order",
        "p.id as product_id",
        "p.code as product_code",
        "p.constraint_type as product_constraint_type",
        "p.unit as product_unit",
      ])
      .where("f.application_id", "in", applicationIds)
      .where("f.is_deprecated", "=", false)
      .orderBy("f.sort_order", "asc")
      .orderBy("f.key", "asc")
      .orderBy("p.code", "asc")
      .execute();

    return rows as unknown as FeatureWithProductsRow[];
  }

  /**
   * Find all navigable, non-deprecated features.
   * Used by the sidebar service to build navigation items from DB data.
   */
  async findNavigableFeatures(): Promise<NavigableFeatureRow[]> {
    const rows = await db
      .selectFrom("features")
      .select(["key", "nav_route", "nav_label", "nav_icon", "nav_sort_order"])
      .where("is_navigable", "=", true)
      .where("is_deprecated", "=", false)
      .orderBy("nav_sort_order", "asc")
      .orderBy("key", "asc")
      .execute();

    return rows.map((r) => ({
      key: r.key,
      nav_route: r.nav_route as string,
      nav_label: r.nav_label as string,
      nav_icon: r.nav_icon as string | null,
      nav_sort_order: Number(r.nav_sort_order ?? 0),
    }));
  }
}

const featuresRepository = new FeaturesRepository();
export default featuresRepository;
