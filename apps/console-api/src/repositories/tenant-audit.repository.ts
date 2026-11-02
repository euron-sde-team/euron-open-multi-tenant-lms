import { db } from "../db/connection";
import { TenantAuditLogEntry, TenantAuditLogQueryParams } from "../types/tenant.type";

/**
 * List unified audit log entries for a tenant (application events + addon events).
 * Fetches from both tables, merges by created_at desc, then applies pagination.
 */
export async function findTenantAuditLogs(
  tenantId: string,
  params: TenantAuditLogQueryParams
): Promise<{ entries: TenantAuditLogEntry[]; total: number }> {
  const page = params.page ?? 1;
  const limit = params.limit ?? 50;
  const offset = (page - 1) * limit;
  const fetchLimit = offset + limit;

  const [appEvents, addonEvents, appCountResult, addonCountResult] = await Promise.all([
    db
      .selectFrom("tenant_application_events")
      .select([
        "id",
        "tenant_application_id as ref_id",
        "tenant_id",
        "application_id",
        "event_type",
        "old_status",
        "new_status",
        "reason",
        "admin_user_id as admin_id",
        "is_system",
        "created_at",
      ])
      .where("tenant_id", "=", tenantId)
      .orderBy("created_at", "desc")
      .limit(fetchLimit)
      .execute(),
    db
      .selectFrom("tenant_addon_events")
      .select([
        "id",
        "tenant_addon_id as ref_id",
        "tenant_id",
        "addon_id",
        "event_type",
        "old_status",
        "new_status",
        "reason",
        "admin_id",
        "is_system",
        "created_at",
      ])
      .where("tenant_id", "=", tenantId)
      .orderBy("created_at", "desc")
      .limit(fetchLimit)
      .execute(),
    db
      .selectFrom("tenant_application_events")
      .select(db.fn.countAll().as("count"))
      .where("tenant_id", "=", tenantId)
      .executeTakeFirst(),
    db
      .selectFrom("tenant_addon_events")
      .select(db.fn.countAll().as("count"))
      .where("tenant_id", "=", tenantId)
      .executeTakeFirst(),
  ]);

  const total = Number(appCountResult?.count ?? 0) + Number(addonCountResult?.count ?? 0);

  const appEntries: TenantAuditLogEntry[] = appEvents.map((e) => ({
    id: e.id,
    kind: "application" as const,
    ref_id: e.ref_id,
    event_type: e.event_type,
    old_status: e.old_status,
    new_status: e.new_status,
    reason: e.reason,
    admin_id: e.admin_id,
    is_system: e.is_system ?? false,
    created_at: e.created_at,
    description: formatAppEventDescription(e.event_type, e.old_status, e.new_status),
  }));

  const addonEntries: TenantAuditLogEntry[] = addonEvents.map((e) => ({
    id: e.id,
    kind: "addon" as const,
    ref_id: e.ref_id,
    event_type: e.event_type,
    old_status: e.old_status,
    new_status: e.new_status ?? "",
    reason: e.reason,
    admin_id: e.admin_id ?? null,
    is_system: e.is_system ?? false,
    created_at: e.created_at,
    description: formatAddonEventDescription(
      e.event_type,
      e.old_status,
      e.new_status ?? ""
    ),
  }));

  const merged = [...appEntries, ...addonEntries].sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  );

  const entries = merged.slice(offset, offset + limit);

  return { entries, total };
}

function formatAppEventDescription(
  eventType: string,
  oldStatus: string | null,
  newStatus: string
): string {
  const from = oldStatus ? ` from ${oldStatus}` : "";
  return `Application ${eventType.replace(/_/g, " ").toLowerCase()}${from} to ${newStatus}`;
}

function formatAddonEventDescription(
  eventType: string,
  oldStatus: string | null,
  newStatus: string
): string {
  const from = oldStatus ? ` from ${oldStatus}` : "";
  return `Add-on ${eventType.replace(/_/g, " ").toLowerCase()}${from} to ${newStatus}`;
}
