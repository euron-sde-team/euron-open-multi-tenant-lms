import tenantNavItemsRepository, {
  type TenantNavItemRow,
} from "../repositories/tenant-nav-items.repository";
import { db } from "../db/connection";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface SidebarNavItem {
  id: string;
  label: string;
  href: string;
  icon?: string;
  badge?: { text: string; variant: string };
  children?: SidebarNavItem[];
  isExternal?: boolean;
}

interface RawSidebarItem extends SidebarNavItem {
  itemType?: string;
  featureKey?: string;
  visible?: boolean;
}

interface SidebarConfigResponse {
  items: SidebarNavItem[];
}

/* ------------------------------------------------------------------ */
/*  Constants                                                          */
/* ------------------------------------------------------------------ */

/** Course feature keys, "All Courses" shown when any is enabled */
const COURSE_FEATURE_KEYS = [
  "self_paced_courses",
  "live_courses",
  "hybrid_courses",
  "shorts_courses",
];

/** System items always present */
const SYSTEM_SIDEBAR_DEFAULTS = [
  { id: "system-home", label: "Home", href: "/", icon: "home" },
];

const ALL_COURSES_DEFAULTS = {
  id: "entitlement-all_courses",
  label: "All Courses",
  href: "/all-courses",
  icon: "layout-grid",
  featureKey: "all_courses",
};

/* ------------------------------------------------------------------ */
/*  Service                                                            */
/* ------------------------------------------------------------------ */

class SidebarService {
  /**
   * Get public sidebar nav items for the web app.
   *
   * Data sources:
   * 1. tenant_nav_items table, if tenant admin has saved config
   * 2. Defaults built from enabled navigable features + system items
   *
   * Filters out hidden items and items whose feature is not entitled,
   * then strips admin-only metadata.
   */
  async getSidebarConfig(tenantId: string): Promise<SidebarConfigResponse> {
    const enabledFeatureKeys = await this.getEnabledFeatureKeys(tenantId);

    // Try persisted nav items first
    const persistedItems = await tenantNavItemsRepository.findByTenantId(tenantId);

    let rawItems: RawSidebarItem[];

    if (persistedItems.length > 0) {
      rawItems = persistedItems.map(rowToRawItem);
    } else {
      // Build defaults from enabled navigable features
      rawItems = await this.buildDefaultItems(enabledFeatureKeys);
    }

    // Filter: visible=true AND entitled
    const items: SidebarNavItem[] = rawItems
      .filter((item) => {
        if (item.visible === false) return false;
        if (item.featureKey) {
          // "all_courses" is special, visible when any course feature is enabled
          if (item.featureKey === "all_courses") {
            return COURSE_FEATURE_KEYS.some((k) => enabledFeatureKeys.has(k));
          }
          // For entitlement items, check if feature is enabled
          if (item.itemType === "entitlement" || item.itemType === "FEATURE") {
            return enabledFeatureKeys.has(item.featureKey);
          }
        }
        return true;
      })
      .map(stripAdminMetadata);

    return { items };
  }

  /**
   * Resolve which feature keys are enabled for the tenant.
   */
  private async getEnabledFeatureKeys(tenantId: string): Promise<Set<string>> {
    const rows = await db
      .selectFrom("entitlements")
      .innerJoin("products", "products.code", "entitlements.product_code")
      .innerJoin("features", "features.id", "products.feature_id")
      .select([
        "features.key",
        "products.constraint_type",
        "entitlements.is_unlimited",
        "entitlements.limit_value",
      ])
      .where("entitlements.tenant_id", "=", tenantId)
      .where("entitlements.is_active", "=", true)
      .execute();

    const featureMap = new Map<string, { hasBooleanGate: boolean; booleanEnabled: boolean; hasAnyEntitlement: boolean }>();

    for (const row of rows) {
      let entry = featureMap.get(row.key);
      if (!entry) {
        entry = { hasBooleanGate: false, booleanEnabled: false, hasAnyEntitlement: false };
        featureMap.set(row.key, entry);
      }
      entry.hasAnyEntitlement = true;
      if (row.constraint_type === "BOOLEAN") {
        entry.hasBooleanGate = true;
        if (row.is_unlimited || row.limit_value >= 1) {
          entry.booleanEnabled = true;
        }
      }
    }

    const enabled = new Set<string>();
    for (const [key, entry] of featureMap) {
      if (entry.hasBooleanGate ? entry.booleanEnabled : entry.hasAnyEntitlement) {
        enabled.add(key);
      }
    }
    return enabled;
  }

  /**
   * Build default navigation items from enabled navigable features.
   * Only includes features the tenant is actually entitled to.
   */
  private async buildDefaultItems(enabledFeatureKeys: Set<string>): Promise<RawSidebarItem[]> {
    const items: RawSidebarItem[] = [];

    // System items
    for (const sys of SYSTEM_SIDEBAR_DEFAULTS) {
      items.push({
        id: sys.id,
        label: sys.label,
        href: sys.href,
        icon: sys.icon,
        itemType: "system",
        visible: true,
      });
    }

    // "All Courses", shown when any course feature is enabled
    const hasAnyCourseFeature = COURSE_FEATURE_KEYS.some((k) => enabledFeatureKeys.has(k));
    if (hasAnyCourseFeature) {
      const allCoursesFeature = await this.getNavigableFeature("all_courses");
      items.push({
        id: ALL_COURSES_DEFAULTS.id,
        label: allCoursesFeature?.nav_label ?? ALL_COURSES_DEFAULTS.label,
        href: allCoursesFeature?.nav_route ?? ALL_COURSES_DEFAULTS.href,
        icon: allCoursesFeature?.nav_icon ?? ALL_COURSES_DEFAULTS.icon,
        itemType: "entitlement",
        featureKey: ALL_COURSES_DEFAULTS.featureKey,
        visible: true,
      });
    }

    // Navigable features from DB, only entitled ones
    const navigableFeatures = await db
      .selectFrom("features")
      .select(["key", "nav_route", "nav_label", "nav_icon", "nav_sort_order"])
      .where("is_navigable", "=", true)
      .where("is_deprecated", "=", false)
      .orderBy("nav_sort_order", "asc")
      .orderBy("key", "asc")
      .execute();

    for (const feature of navigableFeatures) {
      if (feature.key === "all_courses") continue;
      if (!enabledFeatureKeys.has(feature.key)) continue;

      items.push({
        id: `entitlement-${feature.key}`,
        label: feature.nav_label as string,
        href: feature.nav_route as string,
        icon: (feature.nav_icon as string | null) ?? undefined,
        itemType: "entitlement",
        featureKey: feature.key,
        visible: true,
      });
    }

    return items;
  }

  /**
   * Get a single navigable feature by key.
   */
  private async getNavigableFeature(key: string) {
    return db
      .selectFrom("features")
      .select(["nav_route", "nav_label", "nav_icon"])
      .where("key", "=", key)
      .where("is_navigable", "=", true)
      .executeTakeFirst();
  }
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function rowToRawItem(row: TenantNavItemRow): RawSidebarItem {
  const item: RawSidebarItem = {
    id: row.id,
    label: row.label,
    href: row.href,
    icon: row.icon ?? undefined,
    itemType: mapItemTypeReverse(row.item_type),
    featureKey: row.feature_key ?? undefined,
    visible: row.visible,
    isExternal: row.is_external || undefined,
  };

  if (row.badge_text) {
    item.badge = {
      text: row.badge_text,
      variant: row.badge_variant ?? "default",
    };
  }

  return item;
}

function mapItemTypeReverse(dbType: string): string {
  switch (dbType) {
    case "SYSTEM":
      return "system";
    case "FEATURE":
      return "entitlement";
    case "CUSTOM":
      return "custom";
    default:
      return "custom";
  }
}

function stripAdminMetadata(item: RawSidebarItem): SidebarNavItem {
  const { itemType: _type, featureKey: _key, visible: _vis, ...rest } = item;
  return rest as unknown as SidebarNavItem;
}

export default new SidebarService();
