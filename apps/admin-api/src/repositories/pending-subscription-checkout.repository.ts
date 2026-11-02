import { db } from "../db/connection";
import type { billing_cycle } from "../db/enums";

export interface PendingSubscriptionCheckout {
  id: string;
  tenant_id: string;
  external_subscription_id: string;
  plan_version_id: string;
  billing_cycle: billing_cycle;
  currency: string;
  billing_provider_name: string;
  created_at: Date;
}

function mapRow(row: Record<string, unknown>): PendingSubscriptionCheckout {
  return {
    id: row.id as string,
    tenant_id: row.tenant_id as string,
    external_subscription_id: row.external_subscription_id as string,
    plan_version_id: row.plan_version_id as string,
    billing_cycle: row.billing_cycle as billing_cycle,
    currency: row.currency as string,
    billing_provider_name: (row.billing_provider_name as string) ?? "RAZORPAY",
    created_at: new Date(row.created_at as string),
  };
}

class PendingSubscriptionCheckoutRepository {
  async create(data: {
    id: string;
    tenant_id: string;
    external_subscription_id: string;
    plan_version_id: string;
    billing_cycle: billing_cycle;
    currency: string;
    billing_provider_name?: string;
  }): Promise<PendingSubscriptionCheckout> {
    const row = await db
      .insertInto("pending_subscription_checkouts")
      .values({
        id: data.id,
        tenant_id: data.tenant_id,
        external_subscription_id: data.external_subscription_id,
        plan_version_id: data.plan_version_id,
        billing_cycle: data.billing_cycle,
        currency: data.currency,
        billing_provider_name: data.billing_provider_name ?? "RAZORPAY",
      })
      .returningAll()
      .executeTakeFirstOrThrow();
    return mapRow(row);
  }

  async findByExternalId(
    externalSubscriptionId: string
  ): Promise<PendingSubscriptionCheckout | null> {
    const row = await db
      .selectFrom("pending_subscription_checkouts")
      .selectAll()
      .where("external_subscription_id", "=", externalSubscriptionId)
      .executeTakeFirst();
    return row ? mapRow(row) : null;
  }

  async listAll(): Promise<PendingSubscriptionCheckout[]> {
    const rows = await db
      .selectFrom("pending_subscription_checkouts")
      .selectAll()
      .execute();
    return rows.map(mapRow);
  }

  async deleteByExternalId(externalSubscriptionId: string): Promise<number> {
    const result = await db
      .deleteFrom("pending_subscription_checkouts")
      .where("external_subscription_id", "=", externalSubscriptionId)
      .executeTakeFirst();
    return Number(result?.numDeletedRows ?? 0);
  }

  async deleteOlderThan(olderThanMs: number): Promise<number> {
    const cutoff = new Date(Date.now() - olderThanMs);
    const result = await db
      .deleteFrom("pending_subscription_checkouts")
      .where("created_at", "<", cutoff)
      .executeTakeFirst();
    return Number(result?.numDeletedRows ?? 0);
  }
}

export default new PendingSubscriptionCheckoutRepository();
