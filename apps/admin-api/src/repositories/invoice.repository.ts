import { db } from "../db/connection";
import type { Transaction } from "kysely";
import type { DB } from "../db/types";

class InvoiceRepository {
  async create(
    data: {
      id: string;
      tenant_id: string;
      invoice_number: string;
      invoice_type: "PLAN_SUBSCRIPTION" | "USER_PURCHASE";
      subscription_id?: string;
      order_id?: string;
      member_id?: string;
      currency: string;
      subtotal: number;
      tax_amount: number;
      total_amount: number;
      invoice_url: string;
      s3_key: string;
      payment_method?: string;
      transaction_id?: string;
    },
    trx?: Transaction<DB>
  ) {
    const now = new Date();
    return (trx || db)
      .insertInto("invoices")
      .values({
        ...data,
        subtotal: String(data.subtotal),
        tax_amount: String(data.tax_amount),
        total_amount: String(data.total_amount),
        status: "GENERATED",
        generated_at: now,
        created_at: now,
        updated_at: now,
      } as never)
      .returningAll()
      .executeTakeFirstOrThrow();
  }

  async findByTenantId(
    tenantId: string,
    filters?: { invoice_type?: string; page?: number; limit?: number }
  ) {
    let query = db
      .selectFrom("invoices")
      .selectAll()
      .where("tenant_id", "=", tenantId)
      .where("status", "=", "GENERATED");

    if (filters?.invoice_type) {
      query = query.where("invoice_type", "=", filters.invoice_type as never);
    }

    const page = filters?.page || 1;
    const limit = filters?.limit || 20;

    const items = await query
      .orderBy("created_at", "desc")
      .limit(limit)
      .offset((page - 1) * limit)
      .execute();

    const countResult = await db
      .selectFrom("invoices")
      .select(db.fn.countAll().as("count"))
      .where("tenant_id", "=", tenantId)
      .where("status", "=", "GENERATED")
      .executeTakeFirst();

    return {
      items,
      total: Number(countResult?.count ?? 0),
      page,
      limit,
    };
  }

  async findById(id: string, tenantId: string) {
    return db
      .selectFrom("invoices")
      .selectAll()
      .where("id", "=", id)
      .where("tenant_id", "=", tenantId)
      .executeTakeFirst();
  }
}

export default new InvoiceRepository();
