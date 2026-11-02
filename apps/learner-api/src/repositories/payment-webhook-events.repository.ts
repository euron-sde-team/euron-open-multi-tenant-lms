import { ulid } from "ulid";
import { db } from "../db/connection";
import { payment_webhook_status } from "../db/enums";

export async function insertEventIfNew(
  tenantId: string,
  gatewayConnectionId: string,
  providerName: string,
  eventType: string,
  eventId: string,
  payload: unknown
): Promise<string | null> {
  const id = ulid();
  const row = await db
    .insertInto("payment_webhook_events")
    .values({
      id,
      tenant_id: tenantId,
      gateway_connection_id: gatewayConnectionId,
      provider_name: providerName,
      event_type: eventType,
      event_id: eventId,
      payload: JSON.stringify(payload),
      status: payment_webhook_status.PENDING,
    })
    .onConflict((oc) =>
      oc.columns(["tenant_id", "provider_name", "event_id"]).doNothing()
    )
    .returning("id")
    .executeTakeFirst();
  return row?.id ?? null;
}

export async function markProcessed(eventId: string, tenantId: string): Promise<void> {
  await db
    .updateTable("payment_webhook_events")
    .set({
      status: payment_webhook_status.PROCESSED,
      processed_at: new Date(),
    })
    .where("tenant_id", "=", tenantId)
    .where("event_id", "=", eventId)
    .execute();
}

export async function markFailed(
  eventId: string,
  tenantId: string,
  errorMessage: string
): Promise<void> {
  await db
    .updateTable("payment_webhook_events")
    .set({
      status: payment_webhook_status.FAILED,
      error_message: errorMessage,
    })
    .where("tenant_id", "=", tenantId)
    .where("event_id", "=", eventId)
    .execute();
}
