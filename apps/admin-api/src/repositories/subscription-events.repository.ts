import { Transaction } from "kysely";
import { db } from "../db/connection";
import { DB } from "../db/types";

export interface SubscriptionEvent {
  id: string;
  subscription_id: string;
  tenant_id: string;
  event_type: string;
  event_source: string;
  provider_event_id: string | null;
  metadata: Record<string, unknown> | null;
  created_at: Date;
}

class SubscriptionEventsRepository {
  async create(
    data: {
      id: string;
      subscription_id: string;
      tenant_id: string;
      event_type: string;
      event_source: string;
      provider_event_id?: string | null;
      metadata?: Record<string, unknown> | null;
    },
    trx?: Transaction<DB>
  ): Promise<void> {
    const executor = trx || db;
    await executor
      .insertInto("subscription_events")
      .values({
        id: data.id,
        subscription_id: data.subscription_id,
        tenant_id: data.tenant_id,
        event_type: data.event_type,
        event_source: data.event_source,
        provider_event_id: data.provider_event_id ?? null,
        metadata: data.metadata ? JSON.stringify(data.metadata) : null,
      })
      .execute();
  }

  async findBySubscription(
    subscriptionId: string,
    trx?: Transaction<DB>
  ): Promise<SubscriptionEvent[]> {
    const executor = trx || db;
    const rows = await executor
      .selectFrom("subscription_events")
      .selectAll()
      .where("subscription_id", "=", subscriptionId)
      .orderBy("created_at", "desc")
      .execute();
    return rows.map(mapToSubscriptionEvent);
  }

  async findByTenant(
    tenantId: string,
    trx?: Transaction<DB>
  ): Promise<SubscriptionEvent[]> {
    const executor = trx || db;
    const rows = await executor
      .selectFrom("subscription_events")
      .selectAll()
      .where("tenant_id", "=", tenantId)
      .orderBy("created_at", "desc")
      .execute();
    return rows.map(mapToSubscriptionEvent);
  }

  async findBySubscriptionAndType(
    subscriptionId: string,
    eventType: string,
    trx?: Transaction<DB>
  ): Promise<SubscriptionEvent[]> {
    const executor = trx || db;
    const rows = await executor
      .selectFrom("subscription_events")
      .selectAll()
      .where("subscription_id", "=", subscriptionId)
      .where("event_type", "=", eventType)
      .orderBy("created_at", "desc")
      .execute();
    return rows.map(mapToSubscriptionEvent);
  }
}

function mapToSubscriptionEvent(row: Record<string, unknown>): SubscriptionEvent {
  return {
    id: row.id as string,
    subscription_id: row.subscription_id as string,
    tenant_id: row.tenant_id as string,
    event_type: row.event_type as string,
    event_source: row.event_source as string,
    provider_event_id: (row.provider_event_id as string) ?? null,
    metadata: row.metadata as Record<string, unknown> | null,
    created_at: new Date(row.created_at as string),
  };
}

export default new SubscriptionEventsRepository();
