import { BadRequestError } from "../../errors/bad-request.error";
import { toSmallestUnit } from "../../utils/currency-registry";
import logger from "../../utils/logger";

/**
 * Checks that bind a gateway's claim to ONE stored order.
 *
 * A valid signature or a "paid" lookup only proves that some payment happened at
 * the gateway. It says nothing about which of our orders it pays for, or whether
 * it paid the full amount, unless we compare it with what we stored when the
 * order was created.
 */

/**
 * The gateway order id to verify against: always the stored one. A client that
 * sends a different id is presenting proof for another order, so reject it.
 */
export function storedGatewayOrderId(
  order: { id: string; gateway_order_id: string | null },
  claimed: string | null | undefined
): string {
  const stored = order.gateway_order_id;
  if (!stored) throw new BadRequestError("Order has no gateway order");
  if (claimed && claimed !== stored) {
    logger.warn(`[payment] gateway_order_id mismatch for order ${order.id}: claimed ${claimed}, stored ${stored}`);
    throw new BadRequestError("Payment does not belong to this order");
  }
  return stored;
}

/**
 * True when a captured charge (amount in the currency's smallest unit) equals the
 * order total in the order currency.
 */
export function chargeMatchesOrder(
  order: { total_amount: string | number; currency: string },
  amount: number | null | undefined,
  currency: string | null | undefined
): boolean {
  if (amount == null || !currency) return false;
  const expected = toSmallestUnit(Number(order.total_amount), order.currency);
  return Number(amount) === expected && currency.toUpperCase() === order.currency.toUpperCase();
}

/** Throws (and logs) when the charge does not cover exactly this order. */
export function assertChargeMatchesOrder(
  order: { id: string; total_amount: string | number; currency: string },
  amount: number | null | undefined,
  currency: string | null | undefined,
  source: string
): void {
  if (chargeMatchesOrder(order, amount, currency)) return;
  logger.error(
    `[${source}] charge mismatch for order ${order.id}: gateway ${amount ?? "none"} ${currency ?? "none"}, ` +
      `order ${toSmallestUnit(Number(order.total_amount), order.currency)} ${order.currency}`
  );
  throw new BadRequestError("Payment amount does not match the order");
}
