import { ulid } from "ulid";
import { db } from "../db/connection";
import {
  AuditLogEntry,
  AuditLogQueryParams,
  RecordAuditInput,
} from "../types/audit-log.type";

class AuditLogRepository {
  /**
   * Insert an audit log row on its own connection. Audit writes are
   * intentionally NEVER part of a caller's transaction: a slow or failed audit
   * insert must never delay or roll back the primary mutation.
   */
  async create(input: RecordAuditInput): Promise<void> {
    await db
      .insertInto("admin_audit_logs")
      .values({
        id: ulid(),
        actor_admin_id: input.actor.adminId,
        actor_email: input.actor.email,
        actor_name: input.actor.name,
        action: input.action,
        category: input.category,
        resource_id: input.resourceId ?? null,
        resource_label: input.resourceLabel ?? null,
        tenant_id: input.tenantId ?? null,
        summary: input.summary,
        metadata: input.metadata ? JSON.stringify(input.metadata) : null,
        ip_address: input.actor.ipAddress,
        user_agent: input.actor.userAgent,
        is_system: input.isSystem ?? false,
        device: input.device ?? null,
        browser: input.browser ?? null,
        os: input.os ?? null,
        country: input.country ?? null,
        region: input.region ?? null,
        city: input.city ?? null,
        created_at: new Date(),
      })
      .execute();
  }

  /**
   * List audit log rows with filters + pagination.
   */
  async findAll(
    params: AuditLogQueryParams
  ): Promise<{ entries: AuditLogEntry[]; total: number }> {
    const page = params.page || 1;
    const limit = params.limit || 30;
    const offset = (page - 1) * limit;

    let query = db.selectFrom("admin_audit_logs").selectAll();
    let countQuery = db
      .selectFrom("admin_audit_logs")
      .select(db.fn.countAll().as("count"));

    if (params.actor) {
      query = query.where("actor_admin_id", "=", params.actor);
      countQuery = countQuery.where("actor_admin_id", "=", params.actor);
    }
    if (params.category) {
      query = query.where("category", "=", params.category);
      countQuery = countQuery.where("category", "=", params.category);
    }
    if (params.action) {
      query = query.where("action", "=", params.action);
      countQuery = countQuery.where("action", "=", params.action);
    }
    if (params.tenant_id) {
      query = query.where("tenant_id", "=", params.tenant_id);
      countQuery = countQuery.where("tenant_id", "=", params.tenant_id);
    }
    if (params.from) {
      const fromDate = new Date(params.from);
      query = query.where("created_at", ">=", fromDate);
      countQuery = countQuery.where("created_at", ">=", fromDate);
    }
    if (params.to) {
      const toDate = new Date(params.to);
      query = query.where("created_at", "<=", toDate);
      countQuery = countQuery.where("created_at", "<=", toDate);
    }
    if (params.search) {
      const pattern = `%${params.search}%`;
      query = query.where((eb) =>
        eb.or([
          eb("summary", "ilike", pattern),
          eb("actor_email", "ilike", pattern),
          eb("resource_label", "ilike", pattern),
        ])
      );
      countQuery = countQuery.where((eb) =>
        eb.or([
          eb("summary", "ilike", pattern),
          eb("actor_email", "ilike", pattern),
          eb("resource_label", "ilike", pattern),
        ])
      );
    }

    const [rows, countResult] = await Promise.all([
      query
        .orderBy("created_at", "desc")
        .limit(limit)
        .offset(offset)
        .execute(),
      countQuery.executeTakeFirst(),
    ]);

    return {
      entries: rows.map((r) => this.mapToEntry(r)),
      total: Number(countResult?.count || 0),
    };
  }

  async findById(id: string): Promise<AuditLogEntry | null> {
    const row = await db
      .selectFrom("admin_audit_logs")
      .selectAll()
      .where("id", "=", id)
      .executeTakeFirst();
    return row ? this.mapToEntry(row) : null;
  }

  private mapToEntry(row: Record<string, unknown>): AuditLogEntry {
    return {
      id: row.id as string,
      actor_admin_id: (row.actor_admin_id as string | null) ?? null,
      actor_email: (row.actor_email as string | null) ?? null,
      actor_name: (row.actor_name as string | null) ?? null,
      action: row.action as string,
      category: row.category as string,
      resource_id: (row.resource_id as string | null) ?? null,
      resource_label: (row.resource_label as string | null) ?? null,
      tenant_id: (row.tenant_id as string | null) ?? null,
      summary: row.summary as string,
      metadata: (row.metadata as Record<string, unknown> | null) ?? null,
      ip_address: (row.ip_address as string | null) ?? null,
      user_agent: (row.user_agent as string | null) ?? null,
      is_system: Boolean(row.is_system),
      device: (row.device as string | null) ?? null,
      browser: (row.browser as string | null) ?? null,
      os: (row.os as string | null) ?? null,
      country: (row.country as string | null) ?? null,
      region: (row.region as string | null) ?? null,
      city: (row.city as string | null) ?? null,
      created_at: row.created_at as Date,
    };
  }
}

export default new AuditLogRepository();
