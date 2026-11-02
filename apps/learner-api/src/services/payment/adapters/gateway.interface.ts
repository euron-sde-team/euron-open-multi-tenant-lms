import type {
  ConfirmPaymentParams,
  ConfirmPaymentResult,
  CreateOrderParams,
  GatewayOrderResult,
  GatewayRefundResult,
  ParsedWebhookEvent,
  RefundParams,
  VerifyPaymentParams,
} from "../payment-gateway.types";

export interface PaymentGatewayAdapter {
  createOrder(params: CreateOrderParams): Promise<GatewayOrderResult>;
  verifyPayment(params: VerifyPaymentParams): Promise<boolean>;
  /**
   * Ask the gateway directly whether an order was paid, ignoring anything the
   * browser claims.
   *
   * Razorpay hands the browser a signature we can verify offline, so it
   * implements `verifyPayment` and leaves this undefined. Stripe hands back
   * nothing trustworthy (a redirect return with no signature), so the server has
   * to go and ask. Presence of this method is what `checkout.service` branches
   * on, which is why it is optional.
   */
  confirmPayment?(params: ConfirmPaymentParams): Promise<ConfirmPaymentResult>;
  initiateRefund(params: RefundParams): Promise<GatewayRefundResult>;
  parseWebhook(headers: Record<string, string | string[] | undefined>, body: string): Promise<ParsedWebhookEvent>;
  fetchOrderPayments?(gatewayOrderId: string): Promise<{
    payments: Array<{ id: string; status: string; amount: number; currency: string }>;
  }>;
}
