import { NextFunction, Request, Response } from "express";
import { db } from "../db/connection";
import { ForbiddenError } from "../errors/forbidden.error";
import { sendCsv } from "../utils/csv.util";

function getTenantId(req: Request): string {
  const tenantId = req.tenantId;
  if (!tenantId) throw new ForbiddenError("Tenant context required");
  return tenantId;
}

/**
 * GET /tenant/payment/payments/orders/export.csv
 */
export const exportPaymentOrders = async (
  req: Request,
  res: Response,
  _next: NextFunction
): Promise<void> => {
  const tenantId = getTenantId(req);
  const rows = await db
    .selectFrom("payment_orders")
    .select([
      "id",
      "order_number",
      "order_type",
      "currency",
      "total_amount",
      "platform_fee",
      "tenant_payout_amount",
      "status",
      "gateway_provider_name",
      "paid_at",
      "created_at",
    ])
    .where("tenant_id", "=", tenantId)
    .orderBy("created_at", "desc")
    .limit(20_000)
    .execute();

  async function* iter() {
    for (const r of rows) yield r as Record<string, unknown>;
  }

  await sendCsv(
    res,
    {
      filename: `payment-orders-${tenantId}-${new Date().toISOString().slice(0, 10)}.csv`,
      columns: [
        "id",
        "order_number",
        "order_type",
        "currency",
        "total_amount",
        "platform_fee",
        "tenant_payout_amount",
        "status",
        "gateway_provider_name",
        "paid_at",
        "created_at",
      ],
    },
    iter()
  );
};
