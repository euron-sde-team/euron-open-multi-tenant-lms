import { Transaction } from "kysely";
import { db } from "../db/connection";
import { DB } from "../db/types";
import type { tenant_usage_events } from "../db/types";

export type UsageEventRow = tenant_usage_events;

export interface UsageEventInsert {
  id: string;
  tenant_id: string;
  product_code: string;
  scope_type?: string;
  scope_id?: string;
  event_type: string;
  delta: number;
  resulting_value?: number | null;
  resource_type?: string | null;
  resource_id?: string | null;
  idempotency_key?: string | null;
  reason?: string | null;
  actor_type?: string;
  actor_id?: string | null;
  metadata?: unknown | null;
}

class UsageEventsRepository {
  /**
   * Create a usage event record.
   */
  async create(
    data: UsageEventInsert,
    trx?: Transaction<DB>
  ): Promise<void> {
    const executor = trx || db;
    await executor
      .insertInto("tenant_usage_events")
      .values({
        id: data.id,
        tenant_id: data.tenant_id,
        product_code: data.product_code,
        scope_type: data.scope_type ?? "TENANT",
        scope_id: data.scope_id ?? "__TENANT__",
        event_type: data.event_type,
        delta: data.delta,
        resulting_value: data.resulting_value ?? null,
        resource_type: data.resource_type ?? null,
        resource_id: data.resource_id ?? null,
        idempotency_key: data.idempotency_key ?? null,
        reason: data.reason ?? null,
        actor_type: data.actor_type ?? "SYSTEM",
        actor_id: data.actor_id ?? null,
        metadata: data.metadata ?? null,
        created_at: new Date(),
      })
      .execute();
  }

  /**
   * Check if an event with the given idempotency key already exists.
   */
  async existsByIdempotencyKey(
    key: string,
    trx?: Transaction<DB>
  ): Promise<boolean> {
    const executor = trx || db;
    const row = await executor
      .selectFrom("tenant_usage_events")
      .select("id")
      .where("idempotency_key", "=", key)
      .executeTakeFirst();
    return !!row;
  }

  /**
   * Find events by tenant and product code.
   */
  async findByTenantAndProduct(
    tenantId: string,
    productCode: string,
    options?: { limit?: number; offset?: number }
  ): Promise<UsageEventRow[]> {
    let query = db
      .selectFrom("tenant_usage_events")
      .selectAll()
      .where("tenant_id", "=", tenantId)
      .where("product_code", "=", productCode)
      .orderBy("created_at", "desc");

    if (options?.limit) {
      query = query.limit(options.limit);
    }
    if (options?.offset) {
      query = query.offset(options.offset);
    }

    const rows = await query.execute();
    return rows as unknown as UsageEventRow[];
  }

  /**
   * Find events for a specific resource.
   */
  async findByResource(
    resourceType: string,
    resourceId: string
  ): Promise<UsageEventRow[]> {
    const rows = await db
      .selectFrom("tenant_usage_events")
      .selectAll()
      .where("resource_type", "=", resourceType)
      .where("resource_id", "=", resourceId)
      .orderBy("created_at", "desc")
      .execute();
    return rows as unknown as UsageEventRow[];
  }
}

const usageEventsRepository = new UsageEventsRepository();
export default usageEventsRepository;
