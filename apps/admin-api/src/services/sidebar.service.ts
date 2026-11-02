import { ulid } from "ulid";
import tenantFeaturesService from "./tenant-features.service";
import featuresRepository, {
  type NavigableFeatureRow,
} from "../repositories/features.repository";
import tenantNavItemsRepository, {
  type TenantNavItemRow,
} from "../repositories/tenant-nav-items.repository";
import { BadRequestError } from "../errors/bad-request.error";
import { NotFoundError } from "../errors/not-found.error";

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
  itemType?: "system" | "entitlement" | "custom";
  featureKey?: string;
  visible?: boolean;
}

interface SidebarConfigResponse {
  items: (SidebarNavItem & { featureAvailable?: boolean })[];
  enabledFeatures: string[];
  persisted: boolean;
}

/* ------------------------------------------------------------------ */
/*  Constants                                                          */
/* ------------------------------------------------------------------ */

/** Course feature keys, when any is enabled, "All Courses" is entitled */
const COURSE_FEATURE_KEYS = ["self_paced_courses"];

/** System items always present in navigation (not entitlement-gated) */
const SYSTEM_SIDEBAR_DEFAULTS: Array<{
  id: string;
  label: string;
  href: string;
  icon: string;
  /** Default visibility when first seeded (Home stays hidden as before; the
   *  top-navbar features default to shown to preserve existing behavior). */
  defaultVisible?: boolean;
}> = [
  { id: "system-home", label: "Home", href: "/", icon: "home" },
  { id: "system-ask-ai", label: "Ask AI", href: "/ask", icon: "sparkles", defaultVisible: true },
  { id: "system-career-map", label: "Career Map", href: "/career-map", icon: "map", defaultVisible: true },
];

/** "All Courses" synthetic feature, shown when any course feature is entitled */
const ALL_COURSES_DEFAULTS = {
  id: "entitlement-all_courses",
  label: "All Courses",
  href: "/all-courses",
  icon: "layout-grid",
  featureKey: "all_courses",
};

/**
 * Fallback for enabled features not yet marked is_navigable in the DB.
 * Ensures euri_api (AI API) and similar appear in navigation when entitled.
 */
const FEATURE_SIDEBAR_FALLBACKS: Record<string, { label: string; href: string; icon: string }> = {
  euri_api: { label: "AI API", href: "/ai-api", icon: "code" },
};

const VALID_ICON_NAMES = new Set([
  "home", "users", "community", "briefcase", "graduation-cap", "video", "book-open",
  "radio", "layers", "sparkles", "map", "crown", "message-circle", "code",
  "file-text", "search", "bot", "trophy", "zap", "package", "folder",
  "globe", "heart", "star", "bell", "calendar", "settings", "link",
  "image", "music", "shield", "bookmark", "layout-dashboard", "layout-grid", "book-text",
  "folder-tree", "newspaper",
]);

/* ------------------------------------------------------------------ */
/*  Service                                                            */
/* ------------------------------------------------------------------ */

class SidebarService {
  /**
   * Get sidebar config for the tenant admin navigation settings page.
   *
   * Returns ALL navigable features (regardless of entitlement status),
   * annotated with `featureAvailable` so the admin UI can indicate
   * which items the tenant is actually entitled to.
   *
   * Data sources:
   * 1. tenant_nav_items table, if tenant admin has ever saved
   * 2. Defaults built from features table + system items
   *
   * In both cases, newly added navigable features are auto-appended.
   */
  async getSidebarConfig(tenantId: string): Promise<SidebarConfigResponse> {
    // 1. Resolve enabled feature keys from entitlements
    const resolvedApps = await tenantFeaturesService.getResolvedFeatures(tenantId, "lms");
    const enabledFeatureKeys = new Set<string>();
    for (const app of resolvedApps) {
      for (const feature of app.features) {
        if (feature.enabled) {
          enabledFeatureKeys.add(feature.key);
        }
      }
    }
    const enabledFeatures = Array.from(enabledFeatureKeys);

    // 2. Fetch ALL navigable features from DB
    const navigableFeatures = await featuresRepository.findNavigableFeatures();

    // 3. Fetch persisted tenant nav items
    const persistedItems = await tenantNavItemsRepository.findByTenantId(tenantId);

    let items: TenantNavItemRow[];

    if (persistedItems.length === 0) {
      // First time, build defaults with ULID IDs, persist them
      const defaults = this.buildDefaultItems(navigableFeatures, enabledFeatureKeys);
      const fallbackDefaults = this.appendEnabledFallbacks(defaults, enabledFeatureKeys);
      const inserts = fallbackDefaults.map((item, idx) => ({
        id: item.id,
        tenant_id: tenantId,
        item_type: mapItemType(item.itemType),
        feature_key: item.featureKey ?? null,
        label: item.label,
        href: item.href,
        icon: item.icon ?? null,
        sort_order: idx,
        visible: item.visible ?? true,
        is_external: item.isExternal ?? false,
        badge_text: item.badge?.text ?? null,
        badge_variant: item.badge?.variant ?? null,
      }));
      await tenantNavItemsRepository.insertDefaultsIfEmpty(tenantId, inserts);
      items = await tenantNavItemsRepository.findByTenantId(tenantId);
    } else {
      // Check for legacy IDs (non-ULID), lazy migrate
      const hasLegacyIds = persistedItems.some(
        (row) =>
          row.id.startsWith("system-") ||
          row.id.startsWith("entitlement-") ||
          row.id.startsWith("custom-")
      );

      if (hasLegacyIds) {
        // Rebuild with ULID IDs preserving order/visibility
        const migrated = persistedItems.map((row, idx) => ({
          id: ulid(),
          tenant_id: tenantId,
          item_type: row.item_type,
          feature_key: row.feature_key ?? null,
          label: row.label,
          href: row.href,
          icon: row.icon ?? null,
          sort_order: idx,
          visible: row.visible,
          is_external: row.is_external,
          badge_text: row.badge_text ?? null,
          badge_variant: row.badge_variant ?? null,
        }));
        await tenantNavItemsRepository.replaceAll(tenantId, migrated);
        items = await tenantNavItemsRepository.findByTenantId(tenantId);
      } else {
        items = persistedItems;
      }

      // Check for new navigable features to append
      let navItems = items.map(rowToNavItem);
      const existingIds = new Set(navItems.map((i) => i.id));
      navItems = this.appendNewFeatures(navItems, navigableFeatures, enabledFeatureKeys);
      navItems = this.appendEnabledFallbacks(navItems, enabledFeatureKeys);

      // Find newly added items (could be unshifted or pushed)
      const newItems = navItems.filter((i) => !existingIds.has(i.id));
      if (newItems.length > 0) {
        const maxSort = items.length > 0
          ? Math.max(...items.map((r) => r.sort_order))
          : -1;
        const inserts = newItems.map((item, idx) => ({
          id: item.id,
          tenant_id: tenantId,
          item_type: mapItemType(item.itemType),
          feature_key: item.featureKey ?? null,
          label: item.label,
          href: item.href,
          icon: item.icon ?? null,
          sort_order: maxSort + 1 + idx,
          visible: item.visible ?? true,
          is_external: item.isExternal ?? false,
          badge_text: item.badge?.text ?? null,
          badge_variant: item.badge?.variant ?? null,
        }));
        await tenantNavItemsRepository.insertItems(tenantId, inserts);
        items = await tenantNavItemsRepository.findByTenantId(tenantId);
      }
    }

    // 4. Convert to response format and annotate with featureAvailable
    const navItems = items.map(rowToNavItem);
    const responseItems = navItems.map((item) => {
      if (item.itemType === "entitlement" && item.featureKey) {
        const featureAvailable =
          item.featureKey === "all_courses"
            ? COURSE_FEATURE_KEYS.some((k) => enabledFeatureKeys.has(k))
            : enabledFeatureKeys.has(item.featureKey);
        return { ...item, featureAvailable };
      }
      return item;
    });

    return { items: responseItems, enabledFeatures, persisted: true };
  }

  /**
   * Update a single nav item (label, icon, visibility, badge, etc.)
   * Accepts frontend field names (badge, isExternal) and maps to DB columns.
   */
  async updateNavItem(
    tenantId: string,
    itemId: string,
    updates: Record<string, unknown>
  ): Promise<SidebarNavItem> {
    const existing = await tenantNavItemsRepository.findById(tenantId, itemId);
    if (!existing) {
      throw new NotFoundError("Nav item not found");
    }

    // System and feature items cannot change href
    if (
      (existing.item_type === "SYSTEM" || existing.item_type === "FEATURE") &&
      updates.href !== undefined
    ) {
      throw new BadRequestError("Cannot change href for system or feature items");
    }

    // Validate icon if provided
    if (updates.icon !== undefined && updates.icon !== null && !VALID_ICON_NAMES.has(updates.icon as string)) {
      throw new BadRequestError(`Invalid icon name: ${updates.icon}`);
    }

    // Build update object, only allowed fields
    // Map frontend field names to DB column names
    const updateObj: Record<string, unknown> = {};
    if (updates.label !== undefined) updateObj.label = updates.label;
    if (updates.icon !== undefined) updateObj.icon = updates.icon;
    if (updates.visible !== undefined) updateObj.visible = updates.visible;

    // Handle badge, frontend sends { text, variant } or undefined
    if (updates.badge !== undefined) {
      const badge = updates.badge as { text?: string; variant?: string } | null;
      updateObj.badge_text = badge?.text ?? null;
      updateObj.badge_variant = badge?.variant ?? null;
    }

    // Handle isExternal, frontend sends camelCase
    if (updates.isExternal !== undefined && existing.item_type === "CUSTOM") {
      updateObj.is_external = updates.isExternal;
    }

    const updated = await tenantNavItemsRepository.updateItem(tenantId, itemId, updateObj);
    if (!updated) {
      throw new NotFoundError("Nav item not found");
    }

    return rowToNavItem(updated);
  }

  /**
   * Add a custom link to the tenant's sidebar navigation
   */
  async addCustomLink(
    tenantId: string,
    body: { label?: string; href?: string; icon?: string; isExternal?: boolean }
  ): Promise<SidebarNavItem> {
    if (!body.label || !body.href) {
      throw new BadRequestError("label and href are required");
    }

    if (body.icon && !VALID_ICON_NAMES.has(body.icon)) {
      throw new BadRequestError(`Invalid icon name: ${body.icon}`);
    }

    const id = ulid();
    const maxSort = await tenantNavItemsRepository.getMaxSortOrder(tenantId);

    await tenantNavItemsRepository.insertItems(tenantId, [
      {
        id,
        tenant_id: tenantId,
        item_type: "CUSTOM",
        feature_key: null,
        label: body.label,
        href: body.href,
        icon: body.icon ?? null,
        sort_order: maxSort + 1,
        visible: true,
        is_external: body.isExternal ?? false,
        badge_text: null,
        badge_variant: null,
      },
    ]);

    const created = await tenantNavItemsRepository.findById(tenantId, id);
    if (!created) {
      throw new BadRequestError("Failed to create custom link");
    }

    return rowToNavItem(created);
  }

  /**
   * Delete a custom link from the tenant's sidebar navigation
   */
  async deleteCustomLink(tenantId: string, itemId: string): Promise<void> {
    const existing = await tenantNavItemsRepository.findById(tenantId, itemId);
    if (!existing) {
      throw new NotFoundError("Nav item not found");
    }

    if (existing.item_type !== "CUSTOM") {
      throw new BadRequestError("Cannot delete system or feature items");
    }

    await tenantNavItemsRepository.deleteItem(tenantId, itemId);
  }

  /**
   * Reorder all nav items for the tenant
   */
  async reorderItems(tenantId: string, orderedIds: string[]): Promise<void> {
    if (!orderedIds || !Array.isArray(orderedIds) || orderedIds.length === 0) {
      throw new BadRequestError("orderedIds must be a non-empty array");
    }

    // Validate all IDs belong to this tenant
    const allItems = await tenantNavItemsRepository.findByTenantId(tenantId);
    const tenantItemIds = new Set(allItems.map((i) => i.id));

    for (const id of orderedIds) {
      if (!tenantItemIds.has(id)) {
        throw new BadRequestError(`Item ${id} does not belong to this tenant`);
      }
    }

    const orders = orderedIds.map((id, idx) => ({ id, sort_order: idx }));
    await tenantNavItemsRepository.updateSortOrders(tenantId, orders);
  }

  /* ---------------------------------------------------------------- */
  /*  Private helpers                                                  */
  /* ---------------------------------------------------------------- */

  /**
   * Build default navigation items from ALL navigable features + system items.
   * Every navigable feature is included regardless of entitlement status.
   * Entitled features default to visible (matching what end users see).
   * Non-entitled features default to hidden.
   */
  private buildDefaultItems(
    navigableFeatures: NavigableFeatureRow[],
    _enabledFeatureKeys: Set<string>
  ): SidebarNavItem[] {
    const items: SidebarNavItem[] = [];

    // System items first
    for (const sys of SYSTEM_SIDEBAR_DEFAULTS) {
      items.push({
        id: ulid(),
        label: sys.label,
        href: sys.href,
        icon: sys.icon,
        itemType: "system",
        visible: sys.defaultVisible ?? false,
      });
    }

    // "All Courses" synthetic item, always included if it's a navigable feature
    const allCoursesFeature = navigableFeatures.find((f) => f.key === "all_courses");
    if (allCoursesFeature) {
      items.push({
        id: ulid(),
        label: allCoursesFeature.nav_label ?? ALL_COURSES_DEFAULTS.label,
        href: allCoursesFeature.nav_route ?? ALL_COURSES_DEFAULTS.href,
        icon: allCoursesFeature.nav_icon ?? ALL_COURSES_DEFAULTS.icon,
        itemType: "entitlement",
        featureKey: ALL_COURSES_DEFAULTS.featureKey,
        visible: false,
      });
    }

    // ALL navigable features from DB, ordered by nav_sort_order
    // All features default to hidden, tenant admin must explicitly activate
    for (const feature of navigableFeatures) {
      if (feature.key === "all_courses") continue; // already handled above

      items.push({
        id: ulid(),
        label: feature.nav_label,
        href: feature.nav_route,
        icon: feature.nav_icon ?? undefined,
        itemType: "entitlement",
        featureKey: feature.key,
        visible: false,
      });
    }

    return items;
  }

  /**
   * Append newly navigable features that aren't already in the items list.
   * Includes ALL navigable features regardless of entitlement status.
   * New features default to hidden, tenant admin must explicitly activate.
   */
  private appendNewFeatures(
    items: SidebarNavItem[],
    navigableFeatures: NavigableFeatureRow[],
    enabledFeatureKeys: Set<string>
  ): SidebarNavItem[] {
    const existingFeatureKeys = new Set(
      items
        .filter((item) => item.featureKey)
        .map((item) => item.featureKey!)
    );
    const existingSystemHrefs = new Set(
      items
        .filter((item) => item.itemType === "system")
        .map((item) => item.href)
    );

    // Ensure system items exist (dedup by href, not ID)
    for (const sys of SYSTEM_SIDEBAR_DEFAULTS) {
      if (!existingSystemHrefs.has(sys.href)) {
        items.unshift({
          id: ulid(),
          label: sys.label,
          href: sys.href,
          icon: sys.icon,
          itemType: "system",
          visible: sys.defaultVisible ?? false,
        });
        existingSystemHrefs.add(sys.href);
      }
    }

    // Handle "All Courses" synthetic item
    if (!existingFeatureKeys.has("all_courses")) {
      const allCoursesFeature = navigableFeatures.find((f) => f.key === "all_courses");
      if (allCoursesFeature) {
        const hasAnyCourse = COURSE_FEATURE_KEYS.some((k) => enabledFeatureKeys.has(k));
        const allCoursesItem: SidebarNavItem = {
          id: ulid(),
          label: allCoursesFeature.nav_label ?? ALL_COURSES_DEFAULTS.label,
          href: allCoursesFeature.nav_route ?? ALL_COURSES_DEFAULTS.href,
          icon: allCoursesFeature.nav_icon ?? ALL_COURSES_DEFAULTS.icon,
          itemType: "entitlement",
          featureKey: ALL_COURSES_DEFAULTS.featureKey,
          visible: hasAnyCourse,
        };
        // Insert after Home, before first course-type item
        const firstCourseIdx = items.findIndex(
          (i) => i.featureKey && COURSE_FEATURE_KEYS.includes(i.featureKey)
        );
        const insertAt = firstCourseIdx >= 0 ? firstCourseIdx : items.length;
        items.splice(insertAt, 0, allCoursesItem);
        existingFeatureKeys.add("all_courses");
      }
    }

    // Append ALL new navigable features not yet in the list
    for (const feature of navigableFeatures) {
      if (feature.key === "all_courses") continue;
      if (existingFeatureKeys.has(feature.key)) continue;

      items.push({
        id: ulid(),
        label: feature.nav_label,
        href: feature.nav_route,
        icon: feature.nav_icon ?? undefined,
        itemType: "entitlement",
        featureKey: feature.key,
        visible: false,
      });
      existingFeatureKeys.add(feature.key);
    }

    return items;
  }

  /**
   * Append enabled features that have fallbacks but aren't in navigable DB (e.g. euri_api).
   * Ensures AI API and similar appear when entitled even if is_navigable is false.
   */
  private appendEnabledFallbacks(
    items: SidebarNavItem[],
    enabledFeatureKeys: Set<string>
  ): SidebarNavItem[] {
    const existingFeatureKeys = new Set(
      items
        .filter((item) => item.itemType === "entitlement" && item.featureKey)
        .map((item) => item.featureKey!)
    );

    for (const [key, fallback] of Object.entries(FEATURE_SIDEBAR_FALLBACKS)) {
      if (existingFeatureKeys.has(key)) continue;
      if (!enabledFeatureKeys.has(key)) continue;

      items.push({
        id: ulid(),
        label: fallback.label,
        href: fallback.href,
        icon: fallback.icon,
        itemType: "entitlement",
        featureKey: key,
        visible: false,
      });
    }

    return items;
  }
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function rowToNavItem(row: TenantNavItemRow): SidebarNavItem {
  const item: SidebarNavItem = {
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

function mapItemType(itemType?: string): string {
  switch (itemType) {
    case "system":
      return "SYSTEM";
    case "entitlement":
      return "FEATURE";
    case "custom":
      return "CUSTOM";
    default:
      return "CUSTOM";
  }
}

function mapItemTypeReverse(dbType: string): "system" | "entitlement" | "custom" {
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

export default new SidebarService();
