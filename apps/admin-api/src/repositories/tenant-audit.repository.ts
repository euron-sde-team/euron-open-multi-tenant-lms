import { Kysely, sql } from "kysely";

import { db } from "../db/connection";
import { DB } from "../db/types";

export interface AuditLogRow {
  id: string;
  tenant_id: string;
  actor_user_id: string | null;
  actor_email: string | null;
  actor_name: string | null;
  action: string;
  category: string;
  resource_type: string | null;
  resource_id: string | null;
  resource_label: string | null;
  summary: string;
  metadata: unknown;
  succeeded: boolean;
  ip_address: string | null;
  user_agent: string | null;
  device: string | null;
  browser: string | null;
  os: string | null;
  country: string | null;
  region: string | null;
  city: string | null;
  created_at: Date;
}

export interface AuditLogInsert {
  id: string;
  tenant_id: string;
  actor_user_id: string | null;
  actor_email: string | null;
  actor_name: string | null;
  action: string;
  category: string;
  resource_type: string | null;
  resource_id: string | null;
  resource_label: string | null;
  summary: string;
  metadata: unknown | null;
  succeeded: boolean;
  ip_address: string | null;
  user_agent: string | null;
  device: string | null;
  browser: string | null;
  os: string | null;
}

export interface AuditLogFilters {
  tenantId: string;
  /** Only this person's actions. */
  actorUserId?: string;
  /** Only this part of the app, "Courses", "Payments"… */
  category?: string;
  action?: string;
  resourceType?: string;
  resourceId?: string;
  /** false = only blocked attempts; true = only successful ones. */
  succeeded?: boolean;
  from?: Date;
  to?: Date;
  /** Matches the summary, the plain-English line, not the codes. */
  search?: string;
  limit: number;
  offset: number;
}

class TenantAuditRepository {
  /**
   * Append one entry. Never throws in the caller's face, see the service:
   * a failed audit write must not fail the action the user actually asked for.
   */
  async create(entry: AuditLogInsert, trx?: Kysely<DB>): Promise<void> {
    await (trx || db)
      .insertInto("tenant_audit_logs")
      .values({
        ...entry,
        // Kysely + pg: JSON must arrive as a string, never double-serialised.
        metadata:
          entry.metadata == null
            ? null
            : (JSON.stringify(entry.metadata) as never),
        created_at: new Date(),
      } as never)
      .execute();
  }

  private applyFilters(qb: any, f: AuditLogFilters) {
    // Structural, not per-call discipline: the tenant filter is applied here so
    // no caller can forget it and read another tenant's history.
    let q = qb.where("tenant_id", "=", f.tenantId);

    if (f.actorUserId) q = q.where("actor_user_id", "=", f.actorUserId);
    if (f.category) q = q.where("category", "=", f.category);
    if (f.action) q = q.where("action", "=", f.action);
    if (f.resourceType) q = q.where("resource_type", "=", f.resourceType);
    if (f.resourceId) q = q.where("resource_id", "=", f.resourceId);
    if (f.succeeded !== undefined) q = q.where("succeeded", "=", f.succeeded);
    if (f.from) q = q.where("created_at", ">=", f.from);
    if (f.to) q = q.where("created_at", "<=", f.to);
    if (f.search) {
      q = q.where(sql<boolean>`summary ILIKE ${"%" + f.search + "%"}`);
    }
    return q;
  }

  async list(f: AuditLogFilters): Promise<AuditLogRow[]> {
    const rows = await this.applyFilters(
      db.selectFrom("tenant_audit_logs").selectAll(),
      f
    )
      .orderBy("created_at", "desc")
      .limit(f.limit)
      .offset(f.offset)
      .execute();

    return rows as unknown as AuditLogRow[];
  }

  async count(f: AuditLogFilters): Promise<number> {
    const row = await this.applyFilters(
      db
        .selectFrom("tenant_audit_logs")
        .select((eb: any) => eb.fn.countAll().as("count")),
      f
    ).executeTakeFirst();

    // Kysely returns COUNT as a bigint → string.
    const raw = (row as { count?: unknown })?.count;
    return typeof raw === "string" ? parseInt(raw, 10) : Number(raw ?? 0);
  }

  /** Served by the (tenant_id, actor_user_id, created_at) index. */
  async existsSince(f: {
    tenantId: string;
    actorUserId: string;
    action: string;
    resourceId: string | null;
    since: Date;
    succeeded?: boolean;
  }): Promise<boolean> {
    let q = db
      .selectFrom("tenant_audit_logs")
      .select("id")
      .where("tenant_id", "=", f.tenantId)
      .where("actor_user_id", "=", f.actorUserId)
      .where("created_at", ">=", f.since)
      .where("action", "=", f.action)
      .where("succeeded", "=", f.succeeded ?? true);
    q = f.resourceId
      ? q.where("resource_id", "=", f.resourceId)
      : q.where("resource_id", "is", null);

    return !!(await q.limit(1).executeTakeFirst());
  }

  /** Everyone who has ever appeared in this tenant's log, for the filter list. */
  async listActors(
    tenantId: string
  ): Promise<{ id: string; name: string | null; email: string | null }[]> {
    const rows = await db
      .selectFrom("tenant_audit_logs")
      .select(["actor_user_id", "actor_name", "actor_email"])
      .where("tenant_id", "=", tenantId)
      .where("actor_user_id", "is not", null)
      .distinctOn("actor_user_id")
      .orderBy("actor_user_id")
      .orderBy("created_at", "desc")
      .execute();

    return rows.map((r) => ({
      id: r.actor_user_id as string,
      name: r.actor_name,
      email: r.actor_email,
    }));
  }

  /** Retention: drop anything older than the cutoff. Returns rows removed. */
  async deleteOlderThan(cutoff: Date): Promise<number> {
    const result = await db
      .deleteFrom("tenant_audit_logs")
      .where("created_at", "<", cutoff)
      .executeTakeFirst();

    return Number(result.numDeletedRows ?? 0);
  }
}

export default new TenantAuditRepository();
