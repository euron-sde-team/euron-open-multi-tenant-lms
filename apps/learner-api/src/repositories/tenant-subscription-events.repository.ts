import { ulid } from "ulid";
import { db } from "../db/connection";

export interface CreateEventInput {
  tenant_id: string;
  subscription_id: string;
  event_type: string;
  gateway_event_id?: string;
  previous_status?: string;
  new_status: string;
  gateway_payment_id?: string;
  amount?: string;
  metadata?: unknown;
}

class TenantSubscriptionEventsRepository {
  /**
   * Insert event if gateway_event_id is new (idempotency).
   * Returns the inserted row, or null if duplicate.
   */
  async insertEventIfNew(data: CreateEventInput) {
    try {
      return await db
        .insertInto("tenant_subscription_events")
        .values({
          id: ulid(),
          tenant_id: data.tenant_id,
          subscription_id: data.subscription_id,
          event_type: data.event_type,
          gateway_event_id: data.gateway_event_id ?? null,
          previous_status: data.previous_status ?? null,
          new_status: data.new_status,
          gateway_payment_id: data.gateway_payment_id ?? null,
          amount: data.amount ?? null,
          metadata: data.metadata ? JSON.stringify(data.metadata) : null,
          created_at: new Date(),
        })
        .returningAll()
        .executeTakeFirstOrThrow();
    } catch (err: any) {
      // Unique constraint violation on (tenant_id, gateway_event_id) = duplicate
      if (err.code === "23505") return null;
      throw err;
    }
  }
}

export default new TenantSubscriptionEventsRepository();
