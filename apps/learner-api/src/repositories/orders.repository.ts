import { ulid } from "ulid";
import { db } from "../db/connection";
import type { order_type } from "../db/enums";
import { order_status } from "../db/enums";
import { InternalServerError } from "../errors/internal-server.error";

export interface CreateOrderInput {
  tenant_id: string;
  tenant_member_id: string;
  gateway_connection_id: string | null;
  order_number: string;
  order_type: order_type;
  item_id: string;
  currency: string;
  base_amount: string;
  discount_amount: string;
  coupon_id: string | null;
  coupon_code_snapshot: string | null;
  net_amount: string;
  tax_amount: string;
  total_amount: string;
  platform_fee: string;
  tenant_payout_amount: string | null;
  gateway_provider_name: string;
  idempotency_key: string | null;
  metadata?: Record<string, unknown> | null;
  /** Multi-currency snapshots captured at order creation. */
  resolved_country?: string | null;
  tenant_default_currency?: string | null;
  fx_rate_to_tenant_default?: string | null;
}

/**
 * Written to `gateway_provider_name` when an order is settled with no gateway at
 * all. `gateway_connection_id` is NULL on exactly these rows, so
 * `WHERE gateway_provider_name = 'NONE'` is a complete filter for auditing them.
 */
export const NO_GATEWAY_PROVIDER = "NONE";

/**
 * THE invariant that makes a nullable `gateway_connection_id` safe:
 *
 *   an order may only lack a gateway connection when there is nothing to charge.
 *
 * Enforced in code rather than by a database CHECK constraint (deliberate), so
 * every write to `payment_orders` MUST route through here. Coverage is complete
 * because of two facts:
 *   1. There are exactly two insert sites, createOrder below, and the
 *      transactional insert in cart.service.ts. That is why this is exported.
 *   2. No UPDATE anywhere touches `total_amount` or `gateway_connection_id`;
 *      both are write-once. So a row that satisfies this at insert can never
 *      later drift into violating it.
 *
 * Fails closed: a non-numeric, negative or non-zero total is rejected rather
 * than waved through.
 */
export function assertGatewayInvariant(input: {
  gateway_connection_id: string | null;
  gateway_provider_name: string;
  total_amount: string;
  order_number: string;
}): void {
  // A gateway is attached: nothing to check, this is the ordinary case.
  if (input.gateway_connection_id !== null) return;

  const total = Number(input.total_amount);
  if (!Number.isFinite(total) || total !== 0) {
    throw new InternalServerError(
      `Refusing to write order ${input.order_number}: no gateway connection, but total_amount is "${input.total_amount}". A payable order must always have a gateway.`,
    );
  }
  if (input.gateway_provider_name !== NO_GATEWAY_PROVIDER) {
    throw new InternalServerError(
      `Refusing to write order ${input.order_number}: a gateway-less order must record gateway_provider_name="${NO_GATEWAY_PROVIDER}", got "${input.gateway_provider_name}".`,
    );
  }
}

export async function createOrder(input: CreateOrderInput): Promise<string> {
  assertGatewayInvariant(input);
  const id = ulid();
  const now = new Date();
  await db
    .insertInto("payment_orders")
    .values({
      id,
      tenant_id: input.tenant_id,
      tenant_member_id: input.tenant_member_id,
      gateway_connection_id: input.gateway_connection_id,
      order_number: input.order_number,
      order_type: input.order_type,
      item_id: input.item_id,
      currency: input.currency,
      base_amount: input.base_amount,
      discount_amount: input.discount_amount,
      coupon_id: input.coupon_id,
      coupon_code_snapshot: input.coupon_code_snapshot,
      net_amount: input.net_amount,
      tax_amount: input.tax_amount,
      total_amount: input.total_amount,
      platform_fee: input.platform_fee,
      tenant_payout_amount: input.tenant_payout_amount,
      gateway_provider_name: input.gateway_provider_name,
      status: order_status.CREATED,
      idempotency_key: input.idempotency_key,
      metadata: input.metadata ? JSON.stringify(input.metadata) : null,
      resolved_country: input.resolved_country ?? null,
      tenant_default_currency: input.tenant_default_currency ?? null,
      fx_rate_to_tenant_default: input.fx_rate_to_tenant_default ?? null,
      created_at: now,
      updated_at: now,
    })
    .execute();
  return id;
}

export async function findOrderById(
  tenantId: string,
  orderId: string
): Promise<{
  id: string;
  tenant_id: string;
  tenant_member_id: string;
  order_type: string;
  item_id: string;
  status: string;
  gateway_order_id: string | null;
  gateway_connection_id: string | null;
  coupon_id: string | null;
  tenant_payout_amount: string | null;
  net_amount: string | null;
  discount_amount: string | null;
  total_amount: string;
  currency: string;
} | null> {
  const row = await db
    .selectFrom("payment_orders")
    .select([
      "id",
      "tenant_id",
      "tenant_member_id",
      "order_type",
      "item_id",
      "status",
      "gateway_order_id",
      "gateway_connection_id",
      "coupon_id",
      "tenant_payout_amount",
      "net_amount",
      "discount_amount",
      "total_amount",
      "currency",
    ])
    .where("tenant_id", "=", tenantId)
    .where("id", "=", orderId)
    .executeTakeFirst();
  return row ?? null;
}

export async function findOrderByGatewayOrderId(
  tenantId: string,
  gatewayOrderId: string
): Promise<{
  id: string;
  tenant_id: string;
  tenant_member_id: string;
  order_type: string;
  item_id: string;
  status: string;
  gateway_order_id: string | null;
  gateway_connection_id: string | null;
  coupon_id: string | null;
  tenant_payout_amount: string | null;
  net_amount: string | null;
  discount_amount: string | null;
  total_amount: string;
  currency: string;
} | null> {
  const row = await db
    .selectFrom("payment_orders")
    .select([
      "id",
      "tenant_id",
      "tenant_member_id",
      "order_type",
      "item_id",
      "status",
      // Selected even though it equals the lookup key: verifyPayment reads it
      // off the order rather than off the request body, and needs the shape to
      // match findOrderById so the two lookups form a usable union.
      "gateway_order_id",
      "gateway_connection_id",
      "coupon_id",
      "tenant_payout_amount",
      "net_amount",
      "discount_amount",
      "total_amount",
      "currency",
    ])
    .where("tenant_id", "=", tenantId)
    .where("gateway_order_id", "=", gatewayOrderId)
    .executeTakeFirst();
  return row ?? null;
}

/** Find order by gateway_order_id only (for webhooks, tenant unknown). */
export async function findOrderByGatewayOrderIdAnyTenant(gatewayOrderId: string): Promise<{
  id: string;
  tenant_id: string;
  tenant_member_id: string;
  order_type: string;
  item_id: string;
  status: string;
  gateway_connection_id: string | null;
  coupon_id: string | null;
  tenant_payout_amount: string | null;
  net_amount: string | null;
  total_amount: string;
  currency: string;
} | null> {
  const row = await db
    .selectFrom("payment_orders")
    .select([
      "id",
      "tenant_id",
      "tenant_member_id",
      "order_type",
      "item_id",
      "status",
      "gateway_connection_id",
      "coupon_id",
      "tenant_payout_amount",
      "net_amount",
      // Webhooks compare the captured charge with it before marking PAID.
      "total_amount",
      "currency",
    ])
    .where("gateway_order_id", "=", gatewayOrderId)
    .executeTakeFirst();
  return row ?? null;
}

export async function findOrderByIdempotencyKey(
  tenantId: string,
  idempotencyKey: string
): Promise<{
  id: string;
  order_number: string;
  status: string;
  gateway_order_id: string | null;
  gateway_provider_name: string;
  total_amount: string;
  currency: string;
  client_config: unknown;
  item_id: string;
} | null> {
  const row = await db
    .selectFrom("payment_orders")
    .select([
      "id",
      "order_number",
      "status",
      "gateway_order_id",
      "gateway_provider_name",
      "item_id",
      "total_amount",
      "currency",
      "metadata",
    ])
    .where("tenant_id", "=", tenantId)
    .where("idempotency_key", "=", idempotencyKey)
    .executeTakeFirst();
  if (!row) return null;
  const meta = row.metadata as { client_config?: unknown } | null;
  return {
    id: row.id,
    order_number: row.order_number,
    status: row.status,
    gateway_order_id: row.gateway_order_id,
    gateway_provider_name: row.gateway_provider_name,
    total_amount: row.total_amount,
    currency: row.currency,
    client_config: meta?.client_config ?? {},
    item_id: row.item_id,
  };
}

export async function updateOrderToPaymentPending(
  tenantId: string,
  orderId: string,
  gatewayOrderId: string,
  metadata?: Record<string, unknown>
): Promise<void> {
  await db
    .updateTable("payment_orders")
    .set({
      gateway_order_id: gatewayOrderId,
      status: order_status.PAYMENT_PENDING,
      ...(metadata && { metadata: JSON.stringify(metadata) }),
      updated_at: new Date(),
    })
    .where("tenant_id", "=", tenantId)
    .where("id", "=", orderId)
    .execute();
}

export async function updateOrderMetadata(
  tenantId: string,
  orderId: string,
  metadata: Record<string, unknown>
): Promise<void> {
  await db
    .updateTable("payment_orders")
    .set({
      metadata: JSON.stringify(metadata),
      updated_at: new Date(),
    })
    .where("tenant_id", "=", tenantId)
    .where("id", "=", orderId)
    .execute();
}

export async function updateOrderToPaid(
  tenantId: string,
  orderId: string,
  gatewayPaymentId: string,
  gatewaySignature: string | null
): Promise<void> {
  await db
    .updateTable("payment_orders")
    .set({
      gateway_payment_id: gatewayPaymentId,
      gateway_signature: gatewaySignature,
      status: order_status.PAID,
      paid_at: new Date(),
      updated_at: new Date(),
    })
    .where("tenant_id", "=", tenantId)
    .where("id", "=", orderId)
    .execute();
}

export async function updateOrderToFailed(
  tenantId: string,
  orderId: string,
  failureReason: string
): Promise<void> {
  await db
    .updateTable("payment_orders")
    .set({
      status: order_status.FAILED,
      failed_at: new Date(),
      failure_reason: failureReason,
      updated_at: new Date(),
    })
    .where("tenant_id", "=", tenantId)
    .where("id", "=", orderId)
    .execute();
}

/** Read order metadata JSON (lightweight query). */
export async function getOrderMetadata(
  tenantId: string,
  orderId: string
): Promise<Record<string, unknown> | null> {
  const row = await db
    .selectFrom("payment_orders")
    .select("metadata")
    .where("tenant_id", "=", tenantId)
    .where("id", "=", orderId)
    .executeTakeFirst();
  return (row?.metadata as Record<string, unknown> | null) ?? null;
}

/** Mark order as fulfilled in metadata JSON. */
export async function markOrderFulfilled(
  tenantId: string,
  orderId: string
): Promise<void> {
  const row = await db
    .selectFrom("payment_orders")
    .select("metadata")
    .where("tenant_id", "=", tenantId)
    .where("id", "=", orderId)
    .executeTakeFirst();
  const existing = (row?.metadata as Record<string, unknown> | null) ?? {};
  await db
    .updateTable("payment_orders")
    .set({
      metadata: JSON.stringify({ ...existing, fulfilled: true }),
      updated_at: new Date(),
    })
    .where("tenant_id", "=", tenantId)
    .where("id", "=", orderId)
    .execute();
}
