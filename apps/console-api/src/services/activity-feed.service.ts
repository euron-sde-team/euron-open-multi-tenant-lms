import { db } from "../db/connection";
import {
  ActivityFeedEntry,
  ActivityFeedListResponse,
  ActivityFeedQueryParams,
} from "../types/activity-feed.type";

class ActivityFeedService {
  /**
   * Get global activity feed across all tenants.
   * Fetches from tenant_application_events, tenant_addon_events, and usage_events,
   * merges and sorts by created_at descending, then applies pagination.
   */
  async getActivityFeed(
    params: ActivityFeedQueryParams
  ): Promise<ActivityFeedListResponse> {
    const page = params.page ?? 1;
    const limit = params.limit ?? 30;
    const offset = (page - 1) * limit;

    // Determine which sources to include
    const includeApp = !params.kind || params.kind === "application";
    const includeAddon = !params.kind || params.kind === "addon";
    const includeUsage = !params.kind || params.kind === "usage";

    const searchPattern = params.search?.trim()
      ? `%${params.search.trim()}%`
      : null;

    // We fetch enough rows from each source to cover pagination, then merge in-app.
    // This is efficient for reasonable page sizes (<=100).
    const fetchLimit = offset + limit;

    const promises: Promise<ActivityFeedEntry[]>[] = [];
    const countPromises: Promise<number>[] = [];

    if (includeApp) {
      promises.push(this.fetchAppEvents(fetchLimit, searchPattern));
      countPromises.push(this.countAppEvents(searchPattern));
    }
    if (includeAddon) {
      promises.push(this.fetchAddonEvents(fetchLimit, searchPattern));
      countPromises.push(this.countAddonEvents(searchPattern));
    }
    if (includeUsage) {
      promises.push(this.fetchUsageEvents(fetchLimit, searchPattern));
      countPromises.push(this.countUsageEvents(searchPattern));
    }

    const [sources, counts] = await Promise.all([
      Promise.all(promises),
      Promise.all(countPromises),
    ]);

    const total = counts.reduce((a, b) => a + b, 0);

    // Merge all sources, sort by created_at desc, then paginate
    const merged = sources
      .flat()
      .sort(
        (a, b) =>
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );

    const entries = merged.slice(offset, offset + limit);

    return {
      data: entries,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  // ============================================
  // Application Events
  // ============================================

  private async fetchAppEvents(
    fetchLimit: number,
    searchPattern: string | null
  ): Promise<ActivityFeedEntry[]> {
    let query = db
      .selectFrom("tenant_application_events")
      .innerJoin(
        "tenants",
        "tenant_application_events.tenant_id",
        "tenants.id"
      )
      .select([
        "tenant_application_events.id",
        "tenant_application_events.tenant_id",
        "tenants.name as tenant_name",
        "tenant_application_events.event_type",
        "tenant_application_events.old_status",
        "tenant_application_events.new_status",
        "tenant_application_events.reason",
        "tenant_application_events.admin_user_id as admin_id",
        "tenant_application_events.is_system",
        "tenant_application_events.created_at",
      ]);

    if (searchPattern) {
      query = query.where("tenants.name", "ilike", searchPattern);
    }

    const rows = await query
      .orderBy("tenant_application_events.created_at", "desc")
      .limit(fetchLimit)
      .execute();

    return rows.map((e) => ({
      id: e.id,
      kind: "application" as const,
      tenant_id: e.tenant_id,
      tenant_name: e.tenant_name as string,
      event_type: e.event_type,
      description: this.formatDescription(
        "application",
        e.event_type,
        e.old_status as string | null,
        e.new_status as string
      ),
      old_status: (e.old_status as string) ?? null,
      new_status: e.new_status as string,
      reason: e.reason,
      admin_id: (e.admin_id as string) ?? null,
      is_system: e.is_system ?? false,
      created_at: e.created_at as Date,
    }));
  }

  private async countAppEvents(searchPattern: string | null): Promise<number> {
    let query = db
      .selectFrom("tenant_application_events")
      .innerJoin(
        "tenants",
        "tenant_application_events.tenant_id",
        "tenants.id"
      )
      .select(db.fn.countAll().as("count"));

    if (searchPattern) {
      query = query.where("tenants.name", "ilike", searchPattern);
    }

    const result = await query.executeTakeFirst();
    return Number(result?.count ?? 0);
  }

  // ============================================
  // Addon Events
  // ============================================

  private async fetchAddonEvents(
    fetchLimit: number,
    searchPattern: string | null
  ): Promise<ActivityFeedEntry[]> {
    let query = db
      .selectFrom("tenant_addon_events")
      .innerJoin("tenants", "tenant_addon_events.tenant_id", "tenants.id")
      .select([
        "tenant_addon_events.id",
        "tenant_addon_events.tenant_id",
        "tenants.name as tenant_name",
        "tenant_addon_events.event_type",
        "tenant_addon_events.old_status",
        "tenant_addon_events.new_status",
        "tenant_addon_events.reason",
        "tenant_addon_events.admin_id",
        "tenant_addon_events.is_system",
        "tenant_addon_events.created_at",
      ]);

    if (searchPattern) {
      query = query.where("tenants.name", "ilike", searchPattern);
    }

    const rows = await query
      .orderBy("tenant_addon_events.created_at", "desc")
      .limit(fetchLimit)
      .execute();

    return rows.map((e) => ({
      id: e.id,
      kind: "addon" as const,
      tenant_id: e.tenant_id,
      tenant_name: e.tenant_name as string,
      event_type: e.event_type,
      description: this.formatDescription(
        "addon",
        e.event_type,
        (e.old_status as string) ?? null,
        (e.new_status as string) ?? null
      ),
      old_status: (e.old_status as string) ?? null,
      new_status: (e.new_status as string) ?? null,
      reason: e.reason,
      admin_id: e.admin_id ?? null,
      is_system: e.is_system ?? false,
      created_at: e.created_at as Date,
    }));
  }

  private async countAddonEvents(
    searchPattern: string | null
  ): Promise<number> {
    let query = db
      .selectFrom("tenant_addon_events")
      .innerJoin("tenants", "tenant_addon_events.tenant_id", "tenants.id")
      .select(db.fn.countAll().as("count"));

    if (searchPattern) {
      query = query.where("tenants.name", "ilike", searchPattern);
    }

    const result = await query.executeTakeFirst();
    return Number(result?.count ?? 0);
  }

  // ============================================
  // Usage Events
  // ============================================

  private async fetchUsageEvents(
    fetchLimit: number,
    searchPattern: string | null
  ): Promise<ActivityFeedEntry[]> {
    let query = db
      .selectFrom("tenant_usage_events")
      .innerJoin("tenants", "tenant_usage_events.tenant_id", "tenants.id")
      .select([
        "tenant_usage_events.id",
        "tenant_usage_events.tenant_id",
        "tenants.name as tenant_name",
        "tenant_usage_events.event_type",
        "tenant_usage_events.product_code",
        "tenant_usage_events.delta",
        "tenant_usage_events.reason",
        "tenant_usage_events.actor_type",
        "tenant_usage_events.created_at",
      ]);

    if (searchPattern) {
      query = query.where("tenants.name", "ilike", searchPattern);
    }

    const rows = await query
      .orderBy("tenant_usage_events.created_at", "desc")
      .limit(fetchLimit)
      .execute();

    return rows.map((e) => ({
      id: e.id,
      kind: "usage" as const,
      tenant_id: e.tenant_id,
      tenant_name: e.tenant_name as string,
      event_type: e.event_type,
      description: `Usage ${e.event_type.toLowerCase()}: ${e.product_code} (${e.delta > 0 ? "+" : ""}${e.delta})`,
      old_status: null,
      new_status: null,
      reason: e.reason ?? null,
      admin_id: null,
      is_system: e.actor_type === "SYSTEM",
      created_at: e.created_at as Date,
    }));
  }

  private async countUsageEvents(
    searchPattern: string | null
  ): Promise<number> {
    let query = db
      .selectFrom("tenant_usage_events")
      .innerJoin("tenants", "tenant_usage_events.tenant_id", "tenants.id")
      .select(db.fn.countAll().as("count"));

    if (searchPattern) {
      query = query.where("tenants.name", "ilike", searchPattern);
    }

    const result = await query.executeTakeFirst();
    return Number(result?.count ?? 0);
  }

  // ============================================
  // Helpers
  // ============================================

  private formatDescription(
    kind: ActivityFeedEntry["kind"],
    eventType: string,
    oldStatus: string | null,
    newStatus: string | null
  ): string {
    const readable = eventType.replace(/_/g, " ").toLowerCase();
    const label = kind === "application" ? "Application" : "Add-on";
    const from = oldStatus ? ` from ${oldStatus}` : "";
    const to = newStatus ? ` to ${newStatus}` : "";
    return `${label} ${readable}${from}${to}`;
  }
}

export default new ActivityFeedService();
