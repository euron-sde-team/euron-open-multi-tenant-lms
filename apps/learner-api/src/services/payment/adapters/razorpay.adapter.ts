import { createHmac, timingSafeEqual } from "node:crypto";
import type Razorpay from "razorpay";
import { createRazorpayClient } from "../gateway-hosts";
import type {
  CreateOrderParams,
  GatewayOrderResult,
  GatewayRefundResult,
  ParsedWebhookEvent,
  RefundParams,
  VerifyPaymentParams,
} from "../payment-gateway.types";
import type { PaymentGatewayAdapter } from "./gateway.interface";

/** Credentials: key_id, key_secret, webhook_secret (optional for verification) */
export interface RazorpayCredentials {
  key_id: string;
  key_secret: string;
  webhook_secret?: string;
}

export class RazorpayAdapter implements PaymentGatewayAdapter {
  private instance: Razorpay;
  private keyId: string;
  private keySecret: string;

  constructor(credentials: RazorpayCredentials) {
    this.keyId = credentials.key_id;
    this.keySecret = credentials.key_secret;
    this.instance = createRazorpayClient(credentials.key_id, credentials.key_secret);
  }

  async createOrder(params: CreateOrderParams): Promise<GatewayOrderResult> {
    const order = await this.instance.orders.create({
      amount: params.amount,
      currency: params.currency,
      receipt: params.receipt ?? undefined,
      notes: params.notes,
    });
    return {
      gateway_order_id: order.id,
      client_config: {
        key_id: this.keyId,
        order_id: order.id,
        amount: params.amount,
        currency: params.currency,
      },
    };
  }

  verifyPayment(params: VerifyPaymentParams): Promise<boolean> {
    const body = `${params.gateway_order_id}|${params.gateway_payment_id}`;
    const expected = createHmac("sha256", this.keySecret).update(body).digest("hex");
    return Promise.resolve(hexEqual(expected, params.signature));
  }

  async initiateRefund(params: RefundParams): Promise<GatewayRefundResult> {
    const refund = await this.instance.payments.refund(params.gateway_payment_id, {
      amount: params.amount,
      notes: params.notes ? { reason: params.notes } : undefined,
    });
    return { gateway_refund_id: refund.id };
  }

  async fetchOrderPayments(gatewayOrderId: string): Promise<{
    payments: Array<{ id: string; status: string; amount: number; currency: string }>;
  }> {
    const payments = await (this.instance.orders as any).fetchPayments(gatewayOrderId);
    return {
      payments: (payments.items ?? payments ?? []).map((p: any) => ({
        id: p.id,
        status: p.status,
        amount: p.amount,
        currency: p.currency,
      })),
    };
  }

  async parseWebhook(
    _headers: Record<string, string | string[] | undefined>,
    body: string
  ): Promise<ParsedWebhookEvent> {
    const raw = JSON.parse(body) as {
      entity?: string;
      event?: string;
      id?: string;
      payload?: { payment?: { entity?: { id: string; order_id?: string } }; order?: { entity?: { id: string } } };
    };
    const eventType = raw.event ?? "unknown";
    const paymentId = raw.payload?.payment?.entity?.id;
    const orderId = raw.payload?.payment?.entity?.order_id ?? raw.payload?.order?.entity?.id;
    const eventId = raw.id ?? paymentId ?? orderId ?? `${eventType}-${Date.now()}`;
    return {
      event_id: eventId,
      event_type: eventType,
      payload: raw as unknown as Record<string, unknown>,
    };
  }
}

/** Verify Razorpay webhook signature using webhook_secret */
export function verifyRazorpayWebhookSignature(
  body: string,
  signature: string,
  webhookSecret: string
): boolean {
  if (!signature || !webhookSecret) return false;
  const expected = createHmac("sha256", webhookSecret).update(body).digest("hex");
  return hexEqual(expected, signature);
}

/** Constant-time comparison of two hex digests. */
function hexEqual(expected: string, provided: string | null | undefined): boolean {
  if (typeof provided !== "string" || provided.length !== expected.length) return false;
  return timingSafeEqual(Buffer.from(expected, "utf8"), Buffer.from(provided, "utf8"));
}
