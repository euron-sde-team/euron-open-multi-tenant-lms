import { sql } from "kysely";
import { db } from "../db/connection";
import { BillingProviderResponse } from "../types/billing-provider.type";

import type { CredentialFieldSchema } from "../types/billing-provider.type";

interface BillingProviderRow {
  id: string;
  name: string;
  credential_schema: unknown;
  created_at: Date | string;
  updated_at: Date | string;
  is_active: boolean;
  is_visible_to_tenant: boolean;
}

interface CreateParams {
  id: string;
  name: string;
  credential_schema?: unknown;
  is_active: boolean;
  is_visible_to_tenant: boolean;
  created_at: Date;
  updated_at: Date;
}

interface UpdateParams {
  name?: string;
  credential_schema?: unknown;
  is_active?: boolean;
  is_visible_to_tenant?: boolean;
  updated_at: Date;
}

function parseSchema(raw: unknown): CredentialFieldSchema[] | null {
  if (!raw || !Array.isArray(raw)) return null;
  return raw as CredentialFieldSchema[];
}

function toResponse(row: BillingProviderRow): BillingProviderResponse {
  return {
    id: row.id,
    name: row.name,
    credential_schema: parseSchema(row.credential_schema),
    created_at: new Date(row.created_at),
    updated_at: new Date(row.updated_at),
    is_active: Boolean(row.is_active),
    is_visible_to_tenant: Boolean(row.is_visible_to_tenant),
  };
}

class BillingProviderRepository {
  async findAll(params?: {
    is_active?: boolean;
    limit: number;
    offset: number;
  }): Promise<{ rows: BillingProviderResponse[]; total: number }> {
    const limit = params?.limit ?? 50;
    const offset = params?.offset ?? 0;

    let query = db
      .selectFrom("billing_providers")
      .selectAll()
      .orderBy("name", "asc");

    if (params?.is_active !== undefined) {
      query = query.where("is_active", "=", params.is_active);
    }

    const countQuery = params?.is_active !== undefined
      ? db
          .selectFrom("billing_providers")
          .select(db.fn.countAll().as("count"))
          .where("is_active", "=", params.is_active)
      : db.selectFrom("billing_providers").select(db.fn.countAll().as("count"));

    const [rows, countResult] = await Promise.all([
      query.limit(limit).offset(offset).execute(),
      countQuery.executeTakeFirst(),
    ]);

    const total = Number(countResult?.count ?? 0);
    return {
      rows: rows.map((r) =>
        toResponse({
          ...r,
          is_active: r.is_active as boolean,
          is_visible_to_tenant: r.is_visible_to_tenant as boolean,
        })
      ),
      total,
    };
  }

  async findById(id: string): Promise<BillingProviderResponse | undefined> {
    const row = await db
      .selectFrom("billing_providers")
      .selectAll()
      .where("id", "=", id)
      .executeTakeFirst();

    if (!row) return undefined;

    return toResponse({
      ...row,
      is_active: row.is_active as boolean,
      is_visible_to_tenant: row.is_visible_to_tenant as boolean,
    });
  }

  async findByName(name: string): Promise<BillingProviderResponse | undefined> {
    const row = await db
      .selectFrom("billing_providers")
      .selectAll()
      .where("name", "=", name)
      .executeTakeFirst();

    if (!row) return undefined;

    return toResponse({
      ...row,
      is_active: row.is_active as boolean,
      is_visible_to_tenant: row.is_visible_to_tenant as boolean,
    });
  }

  async create(data: CreateParams): Promise<BillingProviderResponse> {
    const row = await db
      .insertInto("billing_providers")
      .values({
        id: data.id,
        name: data.name,
        credential_schema: data.credential_schema != null
          ? JSON.stringify(data.credential_schema)
          : undefined,
        is_active: data.is_active,
        is_visible_to_tenant: data.is_visible_to_tenant,
        created_at: data.created_at,
        updated_at: data.updated_at,
      })
      .returningAll()
      .executeTakeFirstOrThrow();

    return toResponse({
      ...row,
      is_active: row.is_active as boolean,
      is_visible_to_tenant: row.is_visible_to_tenant as boolean,
    });
  }

  async update(id: string, data: UpdateParams): Promise<BillingProviderResponse | undefined> {
    const updateData: Record<string, unknown> = {
      updated_at: data.updated_at,
    };
    if (data.name !== undefined) updateData.name = data.name;
    if (data.is_active !== undefined) updateData.is_active = data.is_active;
    if (data.is_visible_to_tenant !== undefined) updateData.is_visible_to_tenant = data.is_visible_to_tenant;
    if (data.credential_schema !== undefined) {
      updateData.credential_schema = data.credential_schema != null
        ? JSON.stringify(data.credential_schema)
        : null;
    }

    const row = await db
      .updateTable("billing_providers")
      .set(updateData)
      .where("id", "=", id)
      .returningAll()
      .executeTakeFirst();

    if (!row) return undefined;

    return toResponse({
      ...row,
      is_active: row.is_active as boolean,
      is_visible_to_tenant: row.is_visible_to_tenant as boolean,
    });
  }

  async delete(id: string): Promise<boolean> {
    const result = await db
      .deleteFrom("billing_providers")
      .where("id", "=", id)
      .executeTakeFirst();
    return (result.numDeletedRows ?? 0n) > 0n;
  }

  async countSubscriptionsByProvider(providerId: string): Promise<number> {
    const result = await db
      .selectFrom("subscriptions")
      .select(db.fn.countAll().as("count"))
      .where("billing_provider_id", "=", providerId)
      .executeTakeFirst();
    return Number(result?.count ?? 0);
  }

  async countAddonSubscriptionsByProvider(providerId: string): Promise<number> {
    const result = await db
      .selectFrom("addon_subscriptions")
      .select(db.fn.countAll().as("count"))
      .where("billing_provider_id", "=", providerId)
      .executeTakeFirst();
    return Number(result?.count ?? 0);
  }

  async countWebhooksByProvider(providerId: string | null, since?: Date): Promise<number> {
    let query = db
      .selectFrom("billing_webhooks")
      .select(db.fn.countAll().as("count"));

    if (providerId !== null) {
      query = query.where("billing_provider_id", "=", providerId);
    }
    if (since) {
      query = query.where("created_at", ">=", since);
    }

    const result = await query.executeTakeFirst();
    return Number(result?.count ?? 0);
  }

  async countWebhooksThisMonthByProvider(): Promise<{ billing_provider_id: string; count: string }[]> {
    const startOfMonth = new Date();
    startOfMonth.setUTCDate(1);
    startOfMonth.setUTCHours(0, 0, 0, 0);

    const rows = await db
      .selectFrom("billing_webhooks")
      .select(["billing_provider_id", db.fn.countAll().as("count")])
      .where("created_at", ">=", startOfMonth)
      .groupBy("billing_provider_id")
      .execute();

    return rows.map((r) => ({
      billing_provider_id: r.billing_provider_id,
      count: String(r.count),
    }));
  }

  async webhookSuccessRate(providerId: string | null, since?: Date): Promise<number | null> {
    let baseQuery = db.selectFrom("billing_webhooks");
    if (providerId !== null) {
      baseQuery = baseQuery.where("billing_provider_id", "=", providerId);
    }
    if (since) {
      baseQuery = baseQuery.where("created_at", ">=", since);
    }

    const [totalResult, completedResult] = await Promise.all([
      baseQuery.select(db.fn.countAll().as("count")).executeTakeFirst(),
      baseQuery
        .select(db.fn.countAll().as("count"))
        .where("status", "=", "COMPLETED")
        .executeTakeFirst(),
    ]);

    const total = Number(totalResult?.count ?? 0);
    if (total === 0) return null;
    const completed = Number(completedResult?.count ?? 0);
    return Math.round((completed / total) * 1000) / 1000;
  }

  async platformEarningByProvider(since?: Date): Promise<{ billing_provider_id: string | null; total: string }[]> {
    let query = db
      .selectFrom("subscriptions")
      .select([
        "billing_provider_id",
        sql<string>`COALESCE(SUM(
          CASE
            WHEN billing_cycle = 'MONTHLY' THEN price_snapshot
            WHEN billing_cycle = 'YEARLY' THEN price_snapshot / 12
            ELSE 0
          END
        ), 0)`.as("total"),
      ])
      .where("status", "in", ["ACTIVE", "TRIALING"]);

    if (since) {
      query = query.where("current_period_start", ">=", since);
    }

    const rows = await query.groupBy("billing_provider_id").execute();

    return rows.map((r) => ({
      billing_provider_id: r.billing_provider_id,
      total: String(r.total),
    }));
  }

  async subscriptionCountByProvider(): Promise<{ billing_provider_id: string | null; count: string }[]> {
    const rows = await db
      .selectFrom("subscriptions")
      .select(["billing_provider_id", db.fn.countAll().as("count")])
      .where("status", "in", ["ACTIVE", "TRIALING"])
      .groupBy("billing_provider_id")
      .execute();

    return rows.map((r) => ({
      billing_provider_id: r.billing_provider_id,
      count: String(r.count),
    }));
  }

  async countActiveProviders(): Promise<number> {
    const result = await db
      .selectFrom("billing_providers")
      .select(db.fn.countAll().as("count"))
      .where("is_active", "=", true)
      .executeTakeFirst();
    return Number(result?.count ?? 0);
  }
}

export default new BillingProviderRepository();
