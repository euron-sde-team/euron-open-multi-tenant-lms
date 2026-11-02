"use client";

import { useEffect, useRef, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { CheckCircle2, XCircle, Loader2, ArrowLeft } from "lucide-react";
import { cartApi } from "@/lib/api/cart";
import { checkoutApi } from "@/lib/api/checkout";
import { useQueryClient } from "@tanstack/react-query";
import { trackPaymentCompleted } from "@/lib/analytics";

type CallbackStatus = "processing" | "success" | "failed" | "cancelled";

export default function PaymentCallbackClient() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [status, setStatus] = useState<CallbackStatus>("processing");
  const [message, setMessage] = useState("");
  const processedRef = useRef(false);

  const paymentStatus = searchParams.get("payment_status");
  const razorpayPaymentId = searchParams.get("razorpay_payment_id");
  const razorpayOrderId = searchParams.get("razorpay_order_id");
  const razorpaySignature = searchParams.get("razorpay_signature");
  const orderId = searchParams.get("order_id");
  const returnPath = searchParams.get("return_path") || "/";
  const paymentType = searchParams.get("payment_type") || "direct_checkout";
  // Set by whoever built this return URL, in the gateway's minor units (paise).
  const amountMinor = Number(searchParams.get("amount") ?? "");
  const currency = searchParams.get("currency") || "INR";

  /**
   * Report a completed purchase from THIS page.
   *
   * Payments that take the cross domain redirect (the route Razorpay needs on
   * a custom domain) only come back here, so the conversion is reported here.
   */
  const reportPurchase = () => {
    if (!orderId || !Number.isFinite(amountMinor) || amountMinor <= 0) return;
    trackPaymentCompleted(orderId, amountMinor / 100, currency);
  };

  // Stripe hosted checkout. Unlike Razorpay this redirect IS the flow, not a
  // fallback: the buyer left the site entirely and this page is the only place
  // they come back to.
  const gatewayProvider = searchParams.get("provider");
  const stripeSessionId = searchParams.get("session_id");
  const stripeCancelled = searchParams.get("status") === "cancelled";
  const isRedirectConfirmGateway = gatewayProvider === "stripe";

  // For cancelled/failed, don't navigate to the success page
  const goBackPath = paymentType === "cart_checkout" ? "/checkout" : "/";

  useEffect(() => {
    if (processedRef.current) return;
    processedRef.current = true;

    if (paymentStatus === "cancelled") {
      setStatus("cancelled");
      setMessage("Payment was cancelled. No charges were made.");
      return;
    }

    // Stripe return. Handled before the Razorpay parameter check below,
    // which would otherwise reject this as an invalid callback: these send back a
    // session id (or nothing) and nothing that looks like a Razorpay signature.
    if (isRedirectConfirmGateway && orderId) {
      if (stripeCancelled) {
        setStatus("cancelled");
        setMessage("Payment was cancelled. No charges were made.");
        return;
      }

      // verifyPayment rather than a status poll: it asks the gateway directly and
      // fulfils if the webhook has not landed yet, and it short-circuits when
      // the order is already PAID. Stripe waits up to 10s for our webhook before
      // redirecting, so this call is what confirms it otherwise.
      checkoutApi
        .verifyPayment({
          order_id: orderId,
          gateway_order_id: stripeSessionId ?? "",
          gateway_payment_id: "",
          signature: "",
        })
        .then(() => {
          setStatus("success");
          setMessage("Payment successful! Your purchase is being processed.");
          queryClient.invalidateQueries({ queryKey: ["cart"] });
        })
        .catch(async () => {
          // Do not call this a failure yet. Stripe's own bank rails can lag, and
          // the webhook may still be in flight.
          try {
            const statusRes = await checkoutApi.getOrderStatus(orderId);
            if (statusRes.status === "PAID") {
              setStatus("success");
              setMessage("Payment successful! Your purchase is being processed.");
              queryClient.invalidateQueries({ queryKey: ["cart"] });
              return;
            }
          } catch {
            // fall through
          }
          setStatus("failed");
          setMessage(
            "We could not confirm your payment. If money was deducted it will be refunded automatically, or the order will complete shortly."
          );
        });
      return;
    }

    if (paymentStatus !== "success" || !razorpayPaymentId || !razorpaySignature || !orderId) {
      setStatus("failed");
      setMessage("Invalid payment callback. Missing required parameters.");
      return;
    }

    // Verify the payment based on type
    if (paymentType === "cart_checkout") {
      cartApi
        .verifyPayment({
          order_id: orderId,
          gateway_order_id: razorpayOrderId || "",
          gateway_payment_id: razorpayPaymentId,
          signature: razorpaySignature,
        })
        .then(() => {
          setStatus("success");
          setMessage("Payment successful! Your purchase is being processed.");
          reportPurchase();
          queryClient.invalidateQueries({ queryKey: ["cart"] });
        })
        .catch((err: unknown) => {
          setStatus("failed");
          setMessage(
            err instanceof Error
              ? err.message
              : "Payment verification failed. If money was deducted, it will be refunded automatically."
          );
        });
    } else if (paymentType === "direct_checkout") {
      checkoutApi
        .verifyPayment({
          order_id: orderId,
          gateway_order_id: razorpayOrderId || "",
          gateway_payment_id: razorpayPaymentId,
          signature: razorpaySignature,
        })
        .then(() => {
          setStatus("success");
          setMessage("Payment successful! Your purchase is being processed.");
          reportPurchase();
          queryClient.invalidateQueries({ queryKey: ["cart"] });
        })
        .catch((err: unknown) => {
          setStatus("failed");
          setMessage(
            err instanceof Error
              ? err.message
              : "Payment verification failed. If money was deducted, it will be refunded automatically."
          );
        });
    } else {
      setStatus("failed");
      setMessage("Unknown payment type.");
    }
  }, [
    gatewayProvider,
    isRedirectConfirmGateway,
    stripeSessionId,
    stripeCancelled,
    paymentStatus,
    razorpayPaymentId,
    razorpayOrderId,
    razorpaySignature,
    orderId,
    paymentType,
    queryClient,
  ]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="mx-auto max-w-md text-center">
        {status === "processing" && (
          <>
            <Loader2 className="mx-auto h-12 w-12 animate-spin text-primary" />
            <h2 className="mt-4 text-xl font-semibold text-foreground">Verifying Payment</h2>
            <p className="mt-2 text-sm text-muted-foreground">Please wait while we confirm your payment...</p>
          </>
        )}

        {status === "success" && (
          <>
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-green-100 dark:bg-green-950/30">
              <CheckCircle2 className="h-8 w-8 text-green-600 dark:text-green-400" />
            </div>
            <h2 className="mt-4 text-xl font-semibold text-foreground">Payment Successful!</h2>
            <p className="mt-2 text-sm text-muted-foreground">{message}</p>
            <button
              type="button"
              onClick={() => router.push(returnPath)}
              className="mt-6 inline-flex items-center gap-2 rounded-lg bg-primary px-6 py-2.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
            >
              <ArrowLeft className="h-4 w-4" />
              Continue
            </button>
          </>
        )}

        {status === "failed" && (
          <>
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-red-100 dark:bg-red-950/30">
              <XCircle className="h-8 w-8 text-red-600 dark:text-red-400" />
            </div>
            <h2 className="mt-4 text-xl font-semibold text-foreground">Payment Failed</h2>
            <p className="mt-2 text-sm text-muted-foreground">{message}</p>
            <button
              type="button"
              onClick={() => router.push(goBackPath)}
              className="mt-6 inline-flex items-center gap-2 rounded-lg bg-primary px-6 py-2.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
            >
              <ArrowLeft className="h-4 w-4" />
              Go Back
            </button>
          </>
        )}

        {status === "cancelled" && (
          <>
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-amber-100 dark:bg-amber-950/30">
              <XCircle className="h-8 w-8 text-amber-600 dark:text-amber-400" />
            </div>
            <h2 className="mt-4 text-xl font-semibold text-foreground">Payment Cancelled</h2>
            <p className="mt-2 text-sm text-muted-foreground">{message}</p>
            <button
              type="button"
              onClick={() => router.push(goBackPath)}
              className="mt-6 inline-flex items-center gap-2 rounded-lg bg-primary px-6 py-2.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
            >
              <ArrowLeft className="h-4 w-4" />
              Go Back
            </button>
          </>
        )}
      </div>
    </div>
  );
}
