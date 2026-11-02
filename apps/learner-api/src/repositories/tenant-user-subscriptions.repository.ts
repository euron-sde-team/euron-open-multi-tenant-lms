import { ulid } from "ulid";
import { db } from "../db/connection";
import type { tenant_subscription_status } from "../db/enums";
import type { Transaction } from "kysely";
import type { DB } from "../db/types";

export interface CreateSubscriptionInput {
  tenant_id: string;
  member_id: string;
  plan_id: string;
  gateway_connection_id: string;
  gateway_subscription_id?: string;
  gateway_customer_id?: string;
  gateway_provider: string;
  plan_name_snapshot: string;
  billing_cycle_snapshot: string;
  amount_snapshot: string;
  currency_snapshot: string;
  status: tenant_subscription_status;
  short_url?: string;
  trial_ends_at?: Date;
  metadata?: unknown;
}

class TenantUserSubscriptionsRepository {
  async create(data: CreateSubscriptionInput, trx?: Transaction<DB>) {
    const executor = trx || db;
    const id = ulid();
    const now = new Date();
    return (executor as any)
      .insertInto("tenant_user_subscriptions")
      .values({
        id,
        tenant_id: data.tenant_id,
        member_id: data.member_id,
        plan_id: data.plan_id,
        gateway_connection_id: data.gateway_connection_id,
        gateway_subscription_id: data.gateway_subscription_id ?? null,
        gateway_customer_id: data.gateway_customer_id ?? null,
        gateway_provider: data.gateway_provider,
        plan_name_snapshot: data.plan_name_snapshot,
        billing_cycle_snapshot: data.billing_cycle_snapshot,
        amount_snapshot: data.amount_snapshot,
        currency_snapshot: data.currency_snapshot,
        status: data.status,
        short_url: data.short_url ?? null,
        trial_ends_at: data.trial_ends_at ?? null,
        cancel_at_period_end: false,
        payment_failure_count: 0,
        metadata: data.metadata ? JSON.stringify(data.metadata) : null,
        created_at: now,
        updated_at: now,
      })
      .returningAll()
      .executeTakeFirstOrThrow();
  }

  async findById(tenantId: string, subscriptionId: string) {
    return db
      .selectFrom("tenant_user_subscriptions")
      .selectAll()
      .where("id", "=", subscriptionId)
      .where("tenant_id", "=", tenantId)
      .executeTakeFirst();
  }

  async findByGatewaySubscriptionId(gatewaySubscriptionId: string) {
    return db
      .selectFrom("tenant_user_subscriptions")
      .selectAll()
      .where("gateway_subscription_id", "=", gatewaySubscriptionId)
      .executeTakeFirst();
  }

  async findActiveByMemberId(tenantId: string, memberId: string) {
    return db
      .selectFrom("tenant_user_subscriptions")
      .selectAll()
      .where("tenant_id", "=", tenantId)
      .where("member_id", "=", memberId)
      .where("status", "in", ["ACTIVE", "AUTHENTICATED", "PENDING"] as tenant_subscription_status[])
      .orderBy("created_at", "desc")
      .executeTakeFirst();
  }

  async findByMemberIdAndStatus(tenantId: string, memberId: string, status: tenant_subscription_status) {
    return db
      .selectFrom("tenant_user_subscriptions")
      .selectAll()
      .where("tenant_id", "=", tenantId)
      .where("member_id", "=", memberId)
      .where("status", "=", status)
      .orderBy("created_at", "desc")
      .executeTakeFirst();
  }

  async findByMemberId(tenantId: string, memberId: string) {
    return db
      .selectFrom("tenant_user_subscriptions")
      .selectAll()
      .where("tenant_id", "=", tenantId)
      .where("member_id", "=", memberId)
      .orderBy("created_at", "desc")
      .executeTakeFirst();
  }

  async updateStatus(
    tenantId: string,
    subscriptionId: string,
    data: {
      status: tenant_subscription_status;
      current_period_start?: Date;
      current_period_end?: Date;
      trial_ends_at?: Date;
      grace_period_ends_at?: Date;
      cancelled_at?: Date;
      cancel_at_period_end?: boolean;
      ended_at?: Date;
      paused_at?: Date;
      last_payment_at?: Date;
      last_payment_amount?: string;
      next_charge_at?: Date;
      payment_failure_count?: number;
      last_dunning_email_at?: Date;
      short_url?: string;
      gateway_subscription_id?: string;
      gateway_customer_id?: string;
    }
  ) {
    const updateData: Record<string, unknown> = {
      status: data.status,
      updated_at: new Date(),
    };

    if (data.current_period_start !== undefined) updateData.current_period_start = data.current_period_start;
    if (data.current_period_end !== undefined) updateData.current_period_end = data.current_period_end;
    if (data.trial_ends_at !== undefined) updateData.trial_ends_at = data.trial_ends_at;
    if (data.grace_period_ends_at !== undefined) updateData.grace_period_ends_at = data.grace_period_ends_at;
    if (data.cancelled_at !== undefined) updateData.cancelled_at = data.cancelled_at;
    if (data.cancel_at_period_end !== undefined) updateData.cancel_at_period_end = data.cancel_at_period_end;
    if (data.ended_at !== undefined) updateData.ended_at = data.ended_at;
    if (data.paused_at !== undefined) updateData.paused_at = data.paused_at;
    if (data.last_payment_at !== undefined) updateData.last_payment_at = data.last_payment_at;
    if (data.last_payment_amount !== undefined) updateData.last_payment_amount = data.last_payment_amount;
    if (data.next_charge_at !== undefined) updateData.next_charge_at = data.next_charge_at;
    if (data.payment_failure_count !== undefined) updateData.payment_failure_count = data.payment_failure_count;
    if (data.last_dunning_email_at !== undefined) updateData.last_dunning_email_at = data.last_dunning_email_at;
    if (data.short_url !== undefined) updateData.short_url = data.short_url;
    if (data.gateway_subscription_id !== undefined) updateData.gateway_subscription_id = data.gateway_subscription_id;
    if (data.gateway_customer_id !== undefined) updateData.gateway_customer_id = data.gateway_customer_id;

    return db
      .updateTable("tenant_user_subscriptions")
      .set(updateData)
      .where("id", "=", subscriptionId)
      .where("tenant_id", "=", tenantId)
      .returningAll()
      .executeTakeFirst();
  }

  async findPendingVerificationSubscriptions() {
    const cutoff = new Date(Date.now() - 90 * 1000); // 90 seconds ago
    return db
      .selectFrom("tenant_user_subscriptions")
      .selectAll()
      .where("status", "in", ["CREATED", "AUTHENTICATED"] as tenant_subscription_status[])
      .where("created_at", "<", cutoff)
      .where("gateway_subscription_id", "is not", null)
      .orderBy("created_at", "asc")
      .limit(20)
      .execute();
  }

  async findExpiredGracePeriodSubscriptions() {
    const now = new Date();
    return db
      .selectFrom("tenant_user_subscriptions")
      .selectAll()
      .where("status", "in", ["HALTED", "CANCELLED", "PAUSED", "COMPLETED"] as tenant_subscription_status[])
      .where("grace_period_ends_at", "is not", null)
      .where("grace_period_ends_at", "<", now)
      .execute();
  }

  async findSubscriptionsInGracePeriod() {
    const now = new Date();
    return db
      .selectFrom("tenant_user_subscriptions")
      .selectAll()
      .where("status", "in", ["PENDING", "HALTED", "CANCELLED", "PAUSED", "COMPLETED"] as tenant_subscription_status[])
      .where("grace_period_ends_at", "is not", null)
      .where("grace_period_ends_at", ">", now)
      .execute();
  }

  async findSubscriptionsForReminders(statuses: tenant_subscription_status[]) {
    return db
      .selectFrom("tenant_user_subscriptions")
      .selectAll()
      .where("status", "in", statuses)
      .execute();
  }

  async findActiveSubscriptionsApproachingRenewal(daysBeforeRenewal: number) {
    const now = new Date();
    const targetDate = new Date(now.getTime() + daysBeforeRenewal * 24 * 60 * 60 * 1000);
    return db
      .selectFrom("tenant_user_subscriptions")
      .selectAll()
      .where("status", "=", "ACTIVE")
      .where("next_charge_at", "is not", null)
      .where("next_charge_at", "<=", targetDate)
      .where("next_charge_at", ">", now)
      .execute();
  }
}

export default new TenantUserSubscriptionsRepository();
