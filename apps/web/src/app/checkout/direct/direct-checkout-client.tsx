"use client";

import { AlertCircle, ChevronDown, Loader2, Lock, LogIn } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { AccessManagedCta, AvailableRoutesProvider, useToast } from "@open-mtlms/core";
import type { PageConfig, TenantLayout } from "@open-mtlms/shared";
import { getAvailableRoutesResponse } from "@open-mtlms/shared";
import { defaultThemeConfig } from "@open-mtlms/ui-config";

import { EasyCheckoutModal } from "@/components/auth/easy-checkout-modal";
import { LayoutWrapper } from "@/components/layout/layout-wrapper";
import { TenantThemeProvider } from "@/components/providers/tenant-theme-provider";
import { emptyLayout } from "@/lib/default-layout";
import { useBuyNowGuard } from "@/lib/hooks/use-buy-now-guard";
import { useCart } from "@/lib/hooks/use-cart";
import { useStorefrontConfig } from "@/lib/hooks/use-storefront-config";
import { useTenantStatus } from "@/lib/hooks/use-tenant-status";
import { useUserAuthStore } from "@/lib/stores/auth-store";
import { cn } from "@/lib/utils";
import { CHECKOUT_SUCCESS_PATH, checkoutSuccessPath } from "@/lib/utils/checkout-success";

import { AlreadyHasAccessError, checkoutApi, type OrderType, type CouponValidationResult } from "@/lib/api/checkout";
import { CouponOffers } from "@/components/common/CouponOffers";
import { useAvailableCoupons } from "@/lib/hooks/use-available-coupons";
import { useCurrency } from "@/lib/hooks/use-currency";

import { useRazorpay, type RazorpaySuccessResponse } from "@/lib/hooks/use-razorpay";
import {
  isDeferredGateway,
  openGatewayCheckout,
} from "@/lib/payments/open-gateway-checkout";
import { trackPaymentInitiated, trackPaymentCompleted } from "@/lib/analytics";

type CheckoutStatus =
  | "idle"
  | "creating_order"
  | "awaiting_payment"
  | "verifying"
  | "success"
  | "failed"
  | "already_has_access";

interface AlreadyOwnedItem {
  orderType: "COURSE" | "BOOK" | "BUNDLE";
  slug: string | null;
  title: string | null;
}

const VALID_TYPES: OrderType[] = ["COURSE", "BOOK", "BUNDLE", "BATCH", "TEST_SERIES"];

interface DirectCheckoutClientProps {
  layout: TenantLayout | null;
  pageConfig: PageConfig | null;
}

export function DirectCheckoutClient({ layout, pageConfig }: DirectCheckoutClientProps) {
  const theme = pageConfig?.theme ?? defaultThemeConfig;
  const effectiveLayout = layout ?? emptyLayout;
  const tenantName =
    ((pageConfig?.metadata as Record<string, unknown> | undefined)?.tenantName as
      | string
      | undefined) ?? "Store";

  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useToast();
  const { isAuthenticated, member } = useUserAuthStore();
  const { invalidateCart } = useCart();
  const { isLoaded: razorpayReady, error: razorpayError, openRazorpay } = useRazorpay();
  const { isSuspended } = useTenantStatus();
  const { accessManaged, supportEmail } = useStorefrontConfig();
  const guard = useBuyNowGuard();
  const [easyCheckoutOpen, setEasyCheckoutOpen] = useState(false);

  const [hydrated, setHydrated] = useState(false);
  const [status, setStatus] = useState<CheckoutStatus>("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [alreadyOwned, setAlreadyOwned] = useState<AlreadyOwnedItem | null>(null);
  const [couponResult, setCouponResult] = useState<CouponValidationResult | null>(null);
  const [showCouponInput, setShowCouponInput] = useState(false);
  const didRedirectRef = useRef(false);
  const didStartRef = useRef(false);
  const lastOrderIdRef = useRef<string | null>(null);

  const orderType = searchParams.get("type") as OrderType | null;
  const itemId = searchParams.get("id");
  const urlCoupon = searchParams.get("coupon");
  const preferredCurrency = useCurrency();

  const isValid = orderType && VALID_TYPES.includes(orderType) && itemId;

  // Tells the success page what was bought, so it can offer "Go to course".
  const successPath = useMemo(
    () =>
      orderType && itemId
        ? checkoutSuccessPath([{ type: orderType, id: itemId }])
        : CHECKOUT_SUCCESS_PATH,
    [orderType, itemId]
  );

  useEffect(() => {
    setHydrated(true);
  }, []);

  // Auto-validate URL coupon on mount, show coupon input with pre-applied result
  useEffect(() => {
    if (!hydrated || !urlCoupon || !isValid || !isAuthenticated || !preferredCurrency) return;
    setShowCouponInput(true);
    checkoutApi
      .validateCoupon({
        coupon_code: urlCoupon,
        order_type: orderType!,
        item_id: itemId!,
        currency: preferredCurrency,
      })
      .then((result) => setCouponResult(result))
      .catch(() => {
        // Invalid URL coupon, show input so user can try another code
      });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hydrated, isAuthenticated, preferredCurrency]);

  // Offers on this item. Auto-start waits on this: previously the payment sheet
  // opened the instant Razorpay loaded, so the coupon field was on screen for a
  // few hundred milliseconds and buyers had no realistic chance to use it.
  //
  // Not gated on isAuthenticated, the endpoint is optional-auth, so logged-out
  // Easy Checkout shoppers get the list too (minus their per-user limits).
  const { data: availableCoupons = [], isPending: couponsPending } =
    useAvailableCoupons(
      hydrated && isValid && !urlCoupon ? orderType : null,
      hydrated && isValid && !urlCoupon ? itemId : null,
      preferredCurrency,
    );

  // A URL coupon already forces the coupon step, so its lookup never runs and
  // the check counts as finished immediately.
  const couponCheckDone = !!urlCoupon || !couponsPending;

  useEffect(() => {
    if (availableCoupons.length > 0) setShowCouponInput(true);
  }, [availableCoupons.length]);

  useEffect(() => {
    if (!hydrated) return;
    if (didRedirectRef.current) return;
    if (isAuthenticated) return;
    // Access-managed storefront: stay on the page, the contact-support
    // notice below replaces the checkout flow entirely.
    if (accessManaged) return;
    // Wait for the auth-config query to resolve before deciding between
    // the easy-checkout modal and the legacy /login redirect.
    if (!guard.isReady) return;
    if (guard.easyCheckoutEnabled) {
      setEasyCheckoutOpen(true);
      return;
    }
    didRedirectRef.current = true;
    const returnUrl = `/checkout/direct?type=${orderType ?? ""}&id=${itemId ?? ""}`;
    router.replace(`/login?redirect=${encodeURIComponent(returnUrl)}`);
  }, [hydrated, isAuthenticated, accessManaged, guard.isReady, guard.easyCheckoutEnabled, router, orderType, itemId]);

  const startCheckout = useCallback(() => {
    if (!isValid || !razorpayReady || !preferredCurrency || didStartRef.current) return;
    didStartRef.current = true;

    setStatus("creating_order");
    setErrorMessage(null);

    const activeCouponCode = couponResult?.code || urlCoupon || undefined;

    checkoutApi
      .createOrder({
        order_type: orderType!,
        item_id: itemId!,
        currency: preferredCurrency ?? "INR",
        ...(activeCouponCode ? { coupon_code: activeCouponCode } : {}),
      })
      .then((order) => {
        lastOrderIdRef.current = order.order_id;

        // A coupon took the payable amount to zero: the backend already settled
        // the order and granted access, so there is no payment sheet to open.
        if (order.free) {
          setStatus("success");
          toast({
            title: "You're all set",
            description: "Your coupon covered the full amount, no payment needed.",
          });
          invalidateCart();
          router.push(successPath);
          return;
        }

        trackPaymentInitiated(order.order_id, order.client_config.amount / 100, order.client_config.currency);

        // Gateway forced a currency switch (it cannot charge the requested currency)
        if (order.client_config.currency_notice) {
          toast({
            title: "Currency changed",
            description: `This payment method cannot charge ${order.client_config.currency_notice.requested}. You will be charged in ${order.client_config.currency_notice.charged}.`,
          });
        }

        // Stripe: the client cannot prove the outcome, so the server confirms
        // with the gateway. Stripe navigates away to its hosted page.
        if (isDeferredGateway(order.client_config)) {
          const cfg = order.client_config;
          setStatus("awaiting_payment");
          void openGatewayCheckout(cfg).then((outcome) => {
            // Page is leaving for Stripe's hosted page; /payment-callback picks
            // it up from here. Touching state now would fight the navigation.
            if (outcome.kind === "redirecting") return;

            if (outcome.kind === "failed") {
              setStatus("failed");
              setErrorMessage(outcome.message);
              toast({
                title: "Payment failed",
                description: outcome.message,
                variant: "destructive",
              });
              return;
            }

            setStatus("verifying");
            checkoutApi
              .verifyPayment({
                order_id: order.order_id,
                // The server re-reads the stored gateway order id and asks the
                // gateway itself, so these carry no authority - they are sent
                // only to satisfy the shared request shape.
                gateway_order_id: order.gateway_order_id,
                gateway_payment_id: "",
                signature: "",
              })
              .then(() => {
                setStatus("success");
                trackPaymentCompleted(order.order_id, cfg.amount / 100, cfg.currency);
                invalidateCart();
                router.push(successPath);
              })
              .catch(async (err: unknown) => {
                // A closed modal reaches here too. The webhook may have already
                // settled the order, so ask before calling it a failure.
                try {
                  const statusRes = await checkoutApi.getOrderStatus(order.order_id);
                  if (statusRes.status === "PAID") {
                    setStatus("success");
                    trackPaymentCompleted(order.order_id, cfg.amount / 100, cfg.currency);
                    invalidateCart();
                    router.push(successPath);
                    return;
                  }
                } catch {
                  // fall through
                }
                const msg = err instanceof Error ? err.message : "Payment was not completed";
                setStatus("failed");
                setErrorMessage(msg);
                toast({ title: "Payment not completed", description: msg, variant: "destructive" });
              });
          });
          return;
        }

        // Open Razorpay inline
        setStatus("awaiting_payment");

        openRazorpay({
          key: order.client_config.key_id,
          order_id: order.client_config.order_id,
          amount: order.client_config.amount,
          currency: order.client_config.currency,
          name: tenantName,
          description: `${orderType!.charAt(0) + orderType!.slice(1).toLowerCase()} purchase`,
          prefill: {
            name: member?.name ?? "",
            email: member?.email ?? "",
            contact: member?.phone ?? "",
          },
          handler: (response: RazorpaySuccessResponse) => {
            setStatus("verifying");
            checkoutApi
              .verifyPayment({
                order_id: order.order_id,
                gateway_order_id: response.razorpay_order_id,
                gateway_payment_id: response.razorpay_payment_id,
                signature: response.razorpay_signature,
              })
              .then(() => {
                setStatus("success");
                trackPaymentCompleted(order.order_id, order.client_config.amount / 100, order.client_config.currency);
                invalidateCart();
                router.push(successPath);
              })
              .catch(async (err: unknown) => {
                // Verify timed out or failed, check if webhook already processed it
                try {
                  const statusRes = await checkoutApi.getOrderStatus(order.order_id);
                  if (statusRes.status === "PAID") {
                    setStatus("success");
                    trackPaymentCompleted(order.order_id, order.client_config.amount / 100, order.client_config.currency);
                    invalidateCart();
                    router.push(successPath);
                    return;
                  }
                } catch {
                  // Status check failed too, fall through to error
                }
                const msg = err instanceof Error ? err.message : "Payment verification failed";
                setStatus("failed");
                setErrorMessage(msg);
                toast({ title: "Verification failed", description: msg, variant: "destructive" });
              });
          },
          modal: {
            ondismiss: () => {
              setStatus("failed");
              setErrorMessage("Payment was cancelled");
              toast({
                title: "Payment cancelled",
                description: "You closed the payment window. You can try again.",
              });
            },
            confirm_close: true,
          },
          theme: { color: "#6366f1" },
        });
      })
      .catch((err: unknown) => {
        // Backend says the buyer already owns this content with valid access.
        // route to the "Start learning" view instead of treating it as a failure.
        if (err instanceof AlreadyHasAccessError) {
          setStatus("already_has_access");
          setAlreadyOwned({ orderType: err.orderType, slug: err.slug, title: err.title });
          // Allow re-entry to the catch path on retries (e.g. after navigation)
          didStartRef.current = false;
          return;
        }
        const msg = err instanceof Error ? err.message : "Failed to create order";
        // Zero-payable orders no longer surface as an error: create-order settles
        // them server-side and comes back with `free: true`, handled above. That
        // also covers order types the free-enroll endpoint never supported.
        setStatus("failed");
        setErrorMessage(msg);
        // No order was created, so the price is still changeable, and a coupon
        // is the only thing the buyer can change. A PRIVATE coupon is never
        // returned by useAvailableCoupons, so without this the buyer has no way
        // to enter one. It matters most on a storefront with no payment gateway,
        // where a full-discount code is the ONLY way to acquire a paid item, and
        // where this call therefore fails for every buyer who has not applied one.
        setShowCouponInput(true);
        didStartRef.current = false;
        toast({ title: "Order creation failed", description: msg, variant: "destructive" });
      });
  }, [
    isValid,
    razorpayReady,
    orderType,
    itemId,
    successPath,
    preferredCurrency,
    couponResult,
    urlCoupon,
    openRazorpay,
    member,
    tenantName,
    invalidateCart,
    router,
    toast,
  ]);

  // Auto-start checkout when Razorpay is ready (skip if tenant is suspended, the
  // storefront is access-managed, or the coupon step is showing). Also waits for
  // the available-coupon lookup so a buyer who has a code to use is never raced
  // into the payment sheet before the field appears.
  useEffect(() => {
    if (hydrated && isAuthenticated && razorpayReady && isValid && couponCheckDone && status === "idle" && !isSuspended && !accessManaged && !showCouponInput) {
      startCheckout();
    }
  }, [hydrated, isAuthenticated, razorpayReady, isValid, couponCheckDone, status, startCheckout, isSuspended, accessManaged, showCouponInput]);

  const isBusy =
    status === "creating_order" || status === "awaiting_payment" || status === "verifying";

  // Access-managed storefront: no self-checkout, the backend 403s these
  // flows; this is the graceful UI in place of the payment flow.
  if (accessManaged) {
    return (
      <TenantThemeProvider theme={theme}>
        <AvailableRoutesProvider
          initialRoutes={pageConfig?.availableRoutes ?? getAvailableRoutesResponse()}
        >
          <LayoutWrapper layout={effectiveLayout} theme={theme}>
            <section className="bg-background py-16 md:py-24">
              <div className="container-custom">
                <div className="bg-muted/30 mx-auto max-w-xl rounded-xl border border-dashed p-12 text-center">
                  <AlertCircle className="text-muted-foreground mx-auto mb-4 h-10 w-10" />
                  <p className="text-lg font-semibold">Checkout Unavailable</p>
                  <p className="text-muted-foreground mt-2 text-sm">
                    This store does not support self-checkout. Please contact support for access.
                  </p>
                  <div className="mt-6 flex justify-center">
                    <AccessManagedCta hasAccess={false} supportEmail={supportEmail} />
                  </div>
                </div>
              </div>
            </section>
          </LayoutWrapper>
        </AvailableRoutesProvider>
      </TenantThemeProvider>
    );
  }

  return (
    <TenantThemeProvider theme={theme}>
      <AvailableRoutesProvider
        initialRoutes={pageConfig?.availableRoutes ?? getAvailableRoutesResponse()}
      >
        <LayoutWrapper layout={effectiveLayout} theme={theme}>
          <section className="bg-background py-16 md:py-24">
            <div className="container-custom">
              <div className="mx-auto max-w-xl text-center">
                {/* Not authenticated */}
                {!isAuthenticated && hydrated && (
                  <div className="bg-muted/30 rounded-xl border border-dashed p-12">
                    <LogIn className="text-muted-foreground mx-auto mb-4 h-10 w-10" />
                    <p className="text-muted-foreground">
                      Please log in to complete your purchase.
                    </p>
                    <button
                      type="button"
                      onClick={() =>
                        router.push(
                          `/login?redirect=${encodeURIComponent(window.location.pathname + window.location.search)}`
                        )
                      }
                      className="bg-primary text-primary-foreground hover:bg-primary/90 mt-6 rounded-lg px-6 py-3 font-semibold transition-colors"
                    >
                      Log In
                    </button>
                  </div>
                )}

                {/* Invalid params */}
                {isAuthenticated && !isValid && hydrated && (
                  <div className="bg-muted/30 rounded-xl border border-dashed p-12">
                    <AlertCircle className="text-muted-foreground mx-auto mb-4 h-10 w-10" />
                    <p className="text-muted-foreground">
                      Invalid checkout link. Please go back and try again.
                    </p>
                    <button
                      type="button"
                      onClick={() => router.push("/")}
                      className="bg-primary text-primary-foreground hover:bg-primary/90 mt-6 rounded-lg px-6 py-3 font-semibold transition-colors"
                    >
                      Browse Courses
                    </button>
                  </div>
                )}

                {/* Suspended */}
                {isAuthenticated && isValid && isSuspended && !isBusy && status !== "failed" && (
                  <div className="bg-card rounded-xl border p-12 shadow-sm">
                    <AlertCircle className="mx-auto mb-4 h-10 w-10 text-amber-500" />
                    <p className="text-lg font-semibold">Purchases Unavailable</p>
                    <p className="text-muted-foreground mt-2 text-sm">
                      This academy is temporarily unavailable for new purchases. Please try again later.
                    </p>
                    <button
                      type="button"
                      onClick={() => router.back()}
                      className="hover:bg-muted mt-6 rounded-lg border px-6 py-3 font-semibold transition-colors"
                    >
                      Go Back
                    </button>
                  </div>
                )}

                {/* Loading / Processing */}
                {isAuthenticated && isValid && isBusy && (
                  <div className="bg-card rounded-xl border p-12 shadow-sm">
                    <Loader2 className="text-primary mx-auto mb-4 h-10 w-10 animate-spin" />
                    <p className="text-lg font-semibold">
                      {status === "creating_order" && "Creating your order..."}
                      {status === "awaiting_payment" && "Waiting for payment..."}
                      {status === "verifying" && "Verifying payment..."}
                    </p>
                    <p className="text-muted-foreground mt-2 text-sm">
                      Please do not close this page.
                    </p>
                  </div>
                )}

                {/* Idle, waiting for Razorpay to load or coupon entry */}
                {isAuthenticated && isValid && status === "idle" && !showCouponInput && (
                  <div className="bg-card rounded-xl border p-12 shadow-sm">
                    <Loader2 className="text-muted-foreground mx-auto mb-4 h-8 w-8 animate-spin" />
                    <p className="text-muted-foreground">Preparing checkout...</p>
                    {!urlCoupon && (
                      <button
                        type="button"
                        onClick={() => setShowCouponInput(true)}
                        className="text-muted-foreground hover:text-foreground mt-4 inline-flex items-center gap-1 text-sm underline-offset-4 hover:underline"
                      >
                        Have a coupon code?
                        <ChevronDown className="h-3 w-3" />
                      </button>
                    )}
                  </div>
                )}

                {/* Coupon entry mode */}
                {isAuthenticated && isValid && showCouponInput && status === "idle" && (
                  <div className="bg-card rounded-xl border p-8 shadow-sm">
                    <p className="mb-4 text-left text-lg font-semibold">
                      {couponResult ? "Coupon applied" : "Apply a coupon"}
                    </p>
                    <div className="text-left">
                      <CouponOffers
                        orderType={orderType!}
                        itemId={itemId!}
                        currency={preferredCurrency}
                        applied={couponResult}
                        onApply={(result) => setCouponResult(result)}
                        onRemove={() => setCouponResult(null)}
                        showHeading={false}
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        didStartRef.current = false;
                        startCheckout();
                      }}
                      disabled={!razorpayReady}
                      className={cn(
                        "mt-6 flex w-full items-center justify-center gap-2 rounded-lg px-6 py-3 font-semibold transition-colors",
                        "bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
                      )}
                    >
                      <Lock className="h-4 w-4" />
                      {couponResult ? "Pay Now" : "Continue Without Coupon"}
                    </button>
                    {!couponResult && (
                      <button
                        type="button"
                        onClick={() => {
                          setShowCouponInput(false);
                          didStartRef.current = false;
                        }}
                        className="hover:bg-muted mt-2 w-full rounded-lg px-6 py-2 text-sm text-muted-foreground transition-colors"
                      >
                        Skip
                      </button>
                    )}
                  </div>
                )}

                {/* Already owns this content, render a friendly "Start learning" CTA */}
                {status === "already_has_access" && alreadyOwned && (
                  <div className="bg-card rounded-xl border p-12 shadow-sm">
                    <div className="bg-primary/10 text-primary mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full">
                      <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                      </svg>
                    </div>
                    <p className="text-lg font-semibold">
                      You already have access
                      {alreadyOwned.title ? ` to ${alreadyOwned.title}` : ""}.
                    </p>
                    <p className="text-muted-foreground mt-2 text-sm">
                      No need to purchase again, jump back in and continue where you left off.
                    </p>
                    <div className="mt-6 flex flex-wrap justify-center gap-3">
                      <button
                        type="button"
                        onClick={() => {
                          if (alreadyOwned.orderType === "BOOK" && alreadyOwned.slug) {
                            router.push(`/book-reader/${alreadyOwned.slug}`);
                          } else if (alreadyOwned.orderType === "COURSE" && alreadyOwned.slug) {
                            router.push(`/learn/courses/${alreadyOwned.slug}`);
                          } else {
                            router.push("/my-learning");
                          }
                        }}
                        className="bg-primary text-primary-foreground hover:bg-primary/90 rounded-lg px-6 py-3 font-semibold transition-colors"
                      >
                        {alreadyOwned.orderType === "BOOK" ? "Start Reading" : "Start Learning"}
                      </button>
                      <button
                        type="button"
                        onClick={() => router.push("/my-learning")}
                        className="hover:bg-muted rounded-lg border px-6 py-3 font-semibold transition-colors"
                      >
                        My Learning
                      </button>
                    </div>
                  </div>
                )}

                {/* Error */}
                {status === "failed" && (
                  <div className="bg-card rounded-xl border p-12 shadow-sm">
                    <AlertCircle className="text-destructive mx-auto mb-4 h-10 w-10" />
                    <p className="text-lg font-semibold">Payment Failed</p>
                    {errorMessage && (
                      <p className="text-destructive mt-2 text-sm">{errorMessage}</p>
                    )}
                    {razorpayError && (
                      <p className="text-destructive mt-2 text-sm">
                        Payment gateway could not be loaded. Please refresh and try again.
                      </p>
                    )}

                    {/*
                      Coupon recovery. Order creation failed, so nothing has been
                      charged and the price is still changeable. Private coupons
                      are never listed by useAvailableCoupons, so this field is
                      the only way to enter one, and a code that takes the total
                      to zero completes with no gateway at all, which is the whole
                      reason checkout can fail on a storefront that has none.
                    */}
                    {showCouponInput && isValid && orderType && itemId && (
                      <div className="mt-8 border-t pt-6 text-left">
                        <p className="mb-3 text-sm font-semibold">
                          Have a coupon code?
                        </p>
                        <CouponOffers
                          orderType={orderType}
                          itemId={itemId}
                          currency={preferredCurrency}
                          applied={couponResult}
                          onApply={(result) => setCouponResult(result)}
                          onRemove={() => setCouponResult(null)}
                          showHeading={false}
                        />
                        {couponResult && (
                          <button
                            type="button"
                            onClick={() => {
                              didStartRef.current = false;
                              setErrorMessage(null);
                              setStatus("idle");
                              startCheckout();
                            }}
                            className={cn(
                              "mt-4 flex w-full items-center justify-center gap-2 rounded-lg px-6 py-3 font-semibold transition-colors",
                              "bg-primary text-primary-foreground hover:bg-primary/90"
                            )}
                          >
                            <Lock className="h-4 w-4" />
                            Continue
                          </button>
                        )}
                      </div>
                    )}

                    <div className="mt-6 flex justify-center gap-3">
                      <button
                        type="button"
                        onClick={async () => {
                          // Check if webhook already processed the order before starting a new one
                          if (lastOrderIdRef.current) {
                            setStatus("verifying");
                            setErrorMessage(null);
                            try {
                              const statusRes = await checkoutApi.getOrderStatus(lastOrderIdRef.current);
                              if (statusRes.status === "PAID") {
                                setStatus("success");
                                invalidateCart();
                                router.push(successPath);
                                return;
                              }
                            } catch {
                              // Status check failed, fall through to new checkout
                            }
                          }
                          didStartRef.current = false;
                          setStatus("idle");
                          setErrorMessage(null);
                        }}
                        className={cn(
                          "rounded-lg px-6 py-3 font-semibold transition-colors",
                          "bg-primary text-primary-foreground hover:bg-primary/90"
                        )}
                      >
                        <Lock className="mr-2 inline h-4 w-4" />
                        Try Again
                      </button>
                      <button
                        type="button"
                        onClick={() => router.back()}
                        className="hover:bg-muted rounded-lg border px-6 py-3 font-semibold transition-colors"
                      >
                        Go Back
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </section>
          {/* Driven by the auth-redirect effect at top of the component */}
          <EasyCheckoutModal
            open={easyCheckoutOpen}
            onOpenChange={setEasyCheckoutOpen}
            onSuccess={() => setEasyCheckoutOpen(false)}
          />
        </LayoutWrapper>
      </AvailableRoutesProvider>
    </TenantThemeProvider>
  );
}
