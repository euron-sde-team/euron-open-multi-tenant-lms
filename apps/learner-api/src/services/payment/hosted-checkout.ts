import { db } from "../../db/connection";
import { getTenantBaseUrl } from "../../utils/tenant-domain.util";
import type { CreateOrderParams } from "./payment-gateway.types";

/**
 * Extras for hosted-checkout gateways (Stripe): who is paying, what they are
 * buying, and where the gateway sends them back. With hosted checkout the
 * return URL is the buyer's only route back, so it is not optional. Razorpay's
 * modal never leaves the page and does not need these.
 */
export async function buildHostedCheckoutExtras(args: {
  tenantId: string;
  tenantMemberId: string;
  orderId: string;
  productInfo: string;
}): Promise<Pick<CreateOrderParams, "customer" | "product_info" | "return_url">> {
  const { tenantId, tenantMemberId, orderId, productInfo } = args;

  const member = await db
    .selectFrom("tenant_members")
    .select(["name", "email", "phone"])
    .where("id", "=", tenantMemberId)
    .where("tenant_id", "=", tenantId)
    .executeTakeFirst();

  const baseUrl = await getTenantBaseUrl(tenantId);

  return {
    customer: member?.email
      ? { firstname: (member.name ?? "").trim() || "Customer", email: member.email, phone: member.phone ?? "" }
      : undefined,
    product_info: productInfo.slice(0, 100),
    return_url: `${baseUrl}/payment-callback?order_id=${encodeURIComponent(orderId)}`,
  };
}

/** Whether the provider needs buildHostedCheckoutExtras on order creation. */
export const needsHostedCheckoutExtras = (providerName: string): boolean =>
  providerName === "STRIPE";
