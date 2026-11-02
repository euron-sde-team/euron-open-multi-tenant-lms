import { sql } from "kysely";
import { db } from "../db/connection";

export interface PaymentHistoryItem {
  id: string;
  source: "ORDER" | "SUBSCRIPTION";
  type: string;
  description: string;
  amount: string;
  currency: string;
  status: string;
  gateway_payment_id: string | null;
  date: Date;
}

export interface PaymentHistoryFilters {
  page?: number;
  limit?: number;
  source?: "ORDER" | "SUBSCRIPTION" | "ALL";
}

class PaymentHistoryRepository {
  async findByMemberId(
    tenantId: string,
    memberId: string,
    filters?: PaymentHistoryFilters
  ): Promise<{ items: PaymentHistoryItem[]; total: number; page: number; limit: number }> {
    const page = filters?.page || 1;
    const limit = filters?.limit || 20;
    const sourceFilter = filters?.source || "ALL";

    const subscriptionsCte = db
      .selectFrom("tenant_subscription_events as tse")
      .innerJoin(
        "tenant_user_subscriptions as tus",
        "tse.subscription_id",
        "tus.id"
      )
      .select([
        sql<string>`tse.id`.as("id"),
        sql<string>`'SUBSCRIPTION'`.as("source"),
        sql<string>`'SUBSCRIPTION_CHARGE'`.as("type"),
        sql<string>`tus.plan_name_snapshot`.as("description"),
        sql<string>`COALESCE(tse.amount, tus.amount_snapshot)`.as("amount"),
        sql<string>`tus.currency_snapshot`.as("currency"),
        sql<string>`tse.new_status`.as("status"),
        sql<string>`tse.gateway_payment_id`.as("gateway_payment_id"),
        sql<Date>`tse.created_at`.as("date"),
      ])
      .where("tse.tenant_id", "=", tenantId)
      .where("tus.member_id", "=", memberId)
      .where("tse.event_type", "in", ["PAYMENT_SUCCESS", "CHARGED", "ACTIVATED"]);

    if (sourceFilter === "ORDER") {
      const items = await sql<PaymentHistoryItem>`
        (
          SELECT id, 'ORDER' AS source, order_type AS type, order_type AS description,
                 total_amount AS amount, currency, status, gateway_payment_id,
                 COALESCE(paid_at, created_at) AS date
          FROM payment_orders
          WHERE tenant_id = ${tenantId} AND tenant_member_id = ${memberId}
            AND status IN ('PAID', 'REFUNDED', 'PARTIALLY_REFUNDED')
        )
        ORDER BY date DESC
        LIMIT ${limit} OFFSET ${(page - 1) * limit}
      `.execute(db);

      const countResult = await sql<{ count: string }>`
        SELECT (
          (SELECT COUNT(*) FROM payment_orders
           WHERE tenant_id = ${tenantId} AND tenant_member_id = ${memberId}
             AND status IN ('PAID', 'REFUNDED', 'PARTIALLY_REFUNDED'))
        ) AS count
      `.execute(db);

      return { items: items.rows, total: Number(countResult.rows[0]?.count ?? 0), page, limit };
    }

    if (sourceFilter === "SUBSCRIPTION") {
      const items = await subscriptionsCte
        .orderBy("date", "desc")
        .limit(limit)
        .offset((page - 1) * limit)
        .execute() as unknown as PaymentHistoryItem[];

      const countResult = await db
        .selectFrom("tenant_subscription_events as tse")
        .innerJoin(
          "tenant_user_subscriptions as tus",
          "tse.subscription_id",
          "tus.id"
        )
        .select(db.fn.countAll().as("count"))
        .where("tse.tenant_id", "=", tenantId)
        .where("tus.member_id", "=", memberId)
        .where("tse.event_type", "in", ["PAYMENT_SUCCESS", "CHARGED", "ACTIVATED"])
        .executeTakeFirst();

      return { items, total: Number(countResult?.count ?? 0), page, limit };
    }

    // ALL, use raw SQL for UNION ALL (Kysely doesn't support union across different shapes)
    const items = await sql<PaymentHistoryItem>`
      (
        SELECT
          id,
          'ORDER' AS source,
          order_type AS type,
          order_type AS description,
          total_amount AS amount,
          currency,
          status,
          gateway_payment_id,
          COALESCE(paid_at, created_at) AS date
        FROM payment_orders
        WHERE tenant_id = ${tenantId}
          AND tenant_member_id = ${memberId}
          AND status IN ('PAID', 'REFUNDED', 'PARTIALLY_REFUNDED')
      )
      UNION ALL
      (
        SELECT
          tse.id,
          'SUBSCRIPTION' AS source,
          'SUBSCRIPTION_CHARGE' AS type,
          tus.plan_name_snapshot AS description,
          COALESCE(tse.amount, tus.amount_snapshot) AS amount,
          tus.currency_snapshot AS currency,
          tse.new_status AS status,
          tse.gateway_payment_id,
          tse.created_at AS date
        FROM tenant_subscription_events tse
        INNER JOIN tenant_user_subscriptions tus ON tse.subscription_id = tus.id
        WHERE tse.tenant_id = ${tenantId}
          AND tus.member_id = ${memberId}
          AND tse.event_type IN ('PAYMENT_SUCCESS', 'CHARGED', 'ACTIVATED')
      )
      ORDER BY date DESC
      LIMIT ${limit} OFFSET ${(page - 1) * limit}
    `.execute(db);

    const countResult = await sql<{ count: string }>`
      SELECT (
        (
          SELECT COUNT(*)
          FROM payment_orders
          WHERE tenant_id = ${tenantId}
            AND tenant_member_id = ${memberId}
            AND status IN ('PAID', 'REFUNDED', 'PARTIALLY_REFUNDED')
        )
        +
        (
          SELECT COUNT(*)
          FROM tenant_subscription_events tse
          INNER JOIN tenant_user_subscriptions tus ON tse.subscription_id = tus.id
          WHERE tse.tenant_id = ${tenantId}
            AND tus.member_id = ${memberId}
            AND tse.event_type IN ('PAYMENT_SUCCESS', 'CHARGED', 'ACTIVATED')
        )
      ) AS count
    `.execute(db);

    return {
      items: items.rows,
      total: Number(countResult.rows[0]?.count ?? 0),
      page,
      limit,
    };
  }
}

export default new PaymentHistoryRepository();
