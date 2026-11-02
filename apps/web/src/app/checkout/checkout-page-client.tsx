"use client";

import { Loader2, Lock, LogIn, ShoppingBag, Tag, AlertTriangle } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { AccessManagedCta, AvailableRoutesProvider, useToast } from "@open-mtlms/core";
import type { PageConfig, TenantLayout } from "@open-mtlms/shared";
import { getAvailableRoutesResponse , formatMoney, isResolvedPrice, isUnavailablePrice } from "@open-mtlms/shared";
import { defaultThemeConfig } from "@open-mtlms/ui-config";

import { EasyCheckoutModal } from "@/components/auth/easy-checkout-modal";
import { LayoutWrapper } from "@/components/layout/layout-wrapper";
import { TenantThemeProvider } from "@/components/providers/tenant-theme-provider";
import { getCourseThumbnailUrl } from "@/lib/api";
import { emptyLayout } from "@/lib/default-layout";
import { useCart } from "@/lib/hooks/use-cart";
import { useBuyNowGuard } from "@/lib/hooks/use-buy-now-guard";
import { useStorefrontConfig } from "@/lib/hooks/use-storefront-config";
import { useTenantStatus } from "@/lib/hooks/use-tenant-status";
import { useUserAuthStore } from "@/lib/stores/auth-store";
import { cn } from "@/lib/utils";
import { checkoutSuccessPath } from "@/lib/utils/checkout-success";

import { cartApi } from "@/lib/api/cart";
import { checkoutApi } from "@/lib/api/checkout";
import { useCurrency, useCurrencyContext } from "@/lib/hooks/use-currency";
import {
  cartItemCouponDiscount,
  computeEffectiveCurrency,
  resolveCartItemPrice,
} from "@/lib/utils/cart-pricing";
import { useRazorpay, type RazorpaySuccessResponse } from "@/lib/hooks/use-razorpay";
import {
  isDeferredGateway,
  openGatewayCheckout,
} from "@/lib/payments/open-gateway-checkout";
import { trackPaymentInitiated, trackPaymentCompleted } from "@/lib/analytics";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const PLACEHOLDER_IMAGE =
  "https://images.unsplash.com/photo-1516321318423-f06f85e504b3?w=400&h=225&fit=crop&q=80";

function resolveThumbnailUrl(url: string | null): string {
  if (!url) return PLACEHOLDER_IMAGE;
  if (url.startsWith("http") || url.startsWith("data:")) return url;
  return getCourseThumbnailUrl(url) ?? PLACEHOLDER_IMAGE;
}

type CheckoutStatus =
  | "idle"
  | "creating_order"
  | "awaiting_payment"
  | "verifying"
  | "success"
  | "failed";

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

interface CheckoutPageClientProps {
  layout: TenantLayout | null;
  pageConfig: PageConfig | null;
}

export function CheckoutPageClient({ layout, pageConfig }: CheckoutPageClientProps) {
  const theme = pageConfig?.theme ?? defaultThemeConfig;
  const effectiveLayout = layout ?? emptyLayout;
  const tenantName =
    ((pageConfig?.metadata as Record<string, unknown> | undefined)?.tenantName as
      | string
      | undefined) ?? "Store";

  const router = useRouter();
  const { toast } = useToast();
  const { items, summary, isLoading: cartLoading, invalidateCart } = useCart();
  const { isAuthenticated, member } = useUserAuthStore();
  const { isLoaded: razorpayReady, error: razorpayError, openRazorpay } = useRazorpay();
  const preferredCurrency = useCurrency();
  const { resolvedCurrency, defaultCurrency, enabledCurrencies } = useCurrencyContext();
  const { accessManaged, supportEmail } = useStorefrontConfig();
  const { isSuspended, canPurchase } = useTenantStatus();

  const [hydrated, setHydrated] = useState(false);
  const [status, setStatus] = useState<CheckoutStatus>("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const didRedirectRef = useRef(false);
  const lastOrderIdRef = useRef<string | null>(null);
  const guard = useBuyNowGuard();
  const [easyCheckoutOpen, setEasyCheckoutOpen] = useState(false);

  useEffect(() => {
    setHydrated(true);
  }, []);

  // If logged out: show EasyCheckoutModal when Easy Checkout is enabled, otherwise
  // fall back to today's behaviour (redirect to /login). The guard's `isReady`
  // gate is critical here: on a cold load the auth-config query has not
  // resolved yet, and `easyCheckoutEnabled` is `undefined`. Without the gate,
  // we would route the user to /login before learning the tenant actually has
  // easy checkout enabled.
  useEffect(() => {
    if (!hydrated) return;
    if (didRedirectRef.current) return;
    if (isAuthenticated) return;
    // Access-managed storefront: stay on the page, the contact-support
    // notice below replaces the checkout flow entirely.
    if (accessManaged) return;
    if (!guard.isReady) return;
    if (guard.easyCheckoutEnabled) {
      setEasyCheckoutOpen(true);
      return;
    }
    didRedirectRef.current = true;
    router.replace("/login?redirect=/checkout");
  }, [hydrated, isAuthenticated, accessManaged, guard.isReady, guard.easyCheckoutEnabled, router]);

  // Purchasable items (not owned, not free)
  const purchasableItems = useMemo(
    () => items.filter((i) => !i.is_owned && i.purchase_mode !== "FREE"),
    [items]
  );

  // Tells the success page what was bought, so it can offer "Go to course".
  // Captured by the pay handler, so emptying the cart afterwards can't lose it.
  const successPath = useMemo(
    () =>
      checkoutSuccessPath(
        purchasableItems.map((i) => ({ type: i.item_type, id: i.item_id, slug: i.slug }))
      ),
    [purchasableItems]
  );

  const taxPercentage = summary.tax_percentage ?? 0;
  const taxMode = summary.tax_mode;

  // Resolve each item under the buyer's currency. If any item only resolves
  // via the tenant default currency, the whole order is charged in the
  // default currency so every line shares one currency.
  const { effectiveCurrency, forcedToDefault, effectiveCtx } = useMemo(() => {
    const buyerCtx = { resolvedCurrency, defaultCurrency, enabledCurrencies };
    const computed = computeEffectiveCurrency(purchasableItems, buyerCtx);
    return {
      ...computed,
      effectiveCtx: {
        resolvedCurrency: computed.effectiveCurrency,
        defaultCurrency,
        enabledCurrencies,
      },
    };
  }, [purchasableItems, resolvedCurrency, defaultCurrency, enabledCurrencies]);
  const fmt = (n: number) => formatMoney(n, effectiveCurrency);

  // Compute subtotal from individual items (coupon-adjusted)
  const checkoutSubtotal = useMemo(
    () =>
      purchasableItems.reduce((sum, item) => {
        const result = resolveCartItemPrice(item, effectiveCtx);
        const basePrice = isResolvedPrice(result) ? result.amount : 0;
        const couponDiscount = cartItemCouponDiscount(item, effectiveCurrency);
        return sum + (basePrice - couponDiscount);
      }, 0),
    [purchasableItems, effectiveCtx, effectiveCurrency]
  );

  // Compute tax on coupon-adjusted subtotal
  let taxAmount = 0;
  let grandTotal = checkoutSubtotal;

  if (taxMode === "EXCLUSIVE" && taxPercentage > 0) {
    taxAmount = +(checkoutSubtotal * taxPercentage / 100).toFixed(2);
    grandTotal = +(checkoutSubtotal + taxAmount).toFixed(2);
  } else if (taxMode === "INCLUSIVE" && taxPercentage > 0) {
    taxAmount = +(checkoutSubtotal - checkoutSubtotal / (1 + taxPercentage / 100)).toFixed(2);
    grandTotal = checkoutSubtotal;
  }

  // -----------------------------------------------------------------------
  // Single-order checkout: create cart order -> open Razorpay -> verify
  // -----------------------------------------------------------------------
  const handlePayNow = useCallback(() => {
    if (!preferredCurrency || !razorpayReady) {
      toast({
        title: "Loading payment gateway",
        description: "Please wait a moment and try again.",
      });
      return;
    }

    if (purchasableItems.length === 0) {
      toast({ title: "Nothing to pay", description: "No purchasable items in your cart." });
      return;
    }

    setStatus("creating_order");
    setErrorMessage(null);

    cartApi
      .checkout({ currency: effectiveCurrency })
      .then((order) => {
        lastOrderIdRef.current = order.order_id;

        // Coupons covered the whole cart: the backend already settled the order
        // and granted access, so there is no payment sheet to open.
        if (order.free) {
          setStatus("success");
          toast({
            title: "You're all set",
            description: "Your coupons covered the full amount, no payment needed.",
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
            cartApi
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
          description: `${purchasableItems.length} item${purchasableItems.length > 1 ? "s" : ""}`,
          prefill: {
            name: member?.name ?? "",
            email: member?.email ?? "",
            contact: member?.phone ?? "",
          },
          handler: (response: RazorpaySuccessResponse) => {
            setStatus("verifying");
            cartApi
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
        const msg = err instanceof Error ? err.message : "Failed to create order";
        setStatus("failed");
        setErrorMessage(msg);
        toast({ title: "Order creation failed", description: msg, variant: "destructive" });
      });
  }, [
    razorpayReady,
    purchasableItems,
    successPath,
    preferredCurrency,
    effectiveCurrency,
    openRazorpay,
    member,
    tenantName,
    invalidateCart,
    router,
    toast,
  ]);

  const isBusy =
    status === "creating_order" || status === "awaiting_payment" || status === "verifying";

  // Wait for currency detection before rendering prices
  if (!preferredCurrency) {
    return (
      <LayoutWrapper layout={effectiveLayout} theme={theme}>
        <div className="container-custom section-padding flex min-h-[400px] items-center justify-center">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        </div>
      </LayoutWrapper>
    );
  }

  // -----------------------------------------------------------------------
  // Render
  // -----------------------------------------------------------------------

  // Access-managed storefront: no self-checkout, the backend 403s these
  // flows; this is the graceful UI in place of the payment form.
  if (accessManaged) {
    return (
      <TenantThemeProvider theme={theme}>
        <AvailableRoutesProvider
          initialRoutes={pageConfig?.availableRoutes ?? getAvailableRoutesResponse()}
        >
          <LayoutWrapper layout={effectiveLayout} theme={theme}>
            <section className="bg-background py-16 md:py-24">
              <div className="container-custom">
                <div className="bg-muted/30 mx-auto max-w-2xl rounded-xl border border-dashed p-12 text-center">
                  <ShoppingBag className="text-muted-foreground mx-auto mb-4 h-10 w-10" />
                  <h1 className="text-xl font-semibold">Checkout Unavailable</h1>
                  <p className="text-muted-foreground mt-2">
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
              {/* Header */}
              <div className="mx-auto mb-12 max-w-3xl text-center">
                <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">Checkout</h1>
                <p className="text-muted-foreground mt-4 text-lg">
                  Review your order and complete the payment
                </p>
              </div>

              {/* Not authenticated */}
              {!isAuthenticated && (
                <div className="bg-muted/30 mx-auto max-w-2xl rounded-xl border border-dashed p-12 text-center">
                  <LogIn className="text-muted-foreground mx-auto mb-4 h-10 w-10" />
                  <p className="text-muted-foreground">
                    {guard.easyCheckoutEnabled
                      ? "Continue with quick checkout to complete your purchase."
                      : "Please log in to continue with checkout."}
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      if (guard.easyCheckoutEnabled) {
                        setEasyCheckoutOpen(true);
                      } else {
                        router.push("/login?redirect=/checkout");
                      }
                    }}
                    className="bg-primary text-primary-foreground hover:bg-primary/90 mt-6 rounded-lg px-6 py-3 font-semibold transition-colors"
                  >
                    {guard.easyCheckoutEnabled ? "Continue checkout" : "Log In"}
                  </button>
                </div>
              )}

              <EasyCheckoutModal
                open={easyCheckoutOpen}
                onOpenChange={setEasyCheckoutOpen}
                onSuccess={() => {
                  // Authenticated state will flip and the rest of the page renders.
                  setEasyCheckoutOpen(false);
                }}
              />

              {/* Loading */}
              {isAuthenticated && cartLoading && (
                <div className="flex justify-center py-12">
                  <Loader2 className="text-muted-foreground h-8 w-8 animate-spin" />
                </div>
              )}

              {/* Empty cart */}
              {isAuthenticated && !cartLoading && items.length === 0 && status !== "success" && (
                <div className="bg-muted/30 mx-auto max-w-2xl rounded-xl border border-dashed p-12 text-center">
                  <ShoppingBag className="text-muted-foreground mx-auto mb-4 h-10 w-10" />
                  <p className="text-muted-foreground">
                    Your cart is empty. Add courses to get started!
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

              {/* Cart items + payment */}
              {isAuthenticated && !cartLoading && items.length > 0 && (
                <div className="mx-auto max-w-4xl">
                  <div className="grid gap-8 lg:grid-cols-[1fr_380px]">
                    {/* Items list */}
                    <div className="space-y-4">
                      <h2 className="text-lg font-semibold">
                        Order Summary ({purchasableItems.length}{" "}
                        {purchasableItems.length === 1 ? "item" : "items"})
                      </h2>
                      {items.map((item) => (
                        <div
                          key={item.id}
                          className={cn(
                            "bg-card flex items-center gap-4 rounded-xl border p-4 transition-opacity",
                            item.is_owned && "opacity-50"
                          )}
                        >
                          <div className="bg-muted h-16 w-24 shrink-0 overflow-hidden rounded-lg">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={resolveThumbnailUrl(item.thumbnail_url)}
                              alt={item.title}
                              className="h-full w-full object-cover"
                              onError={(e) => {
                                (e.target as HTMLImageElement).src = PLACEHOLDER_IMAGE;
                              }}
                            />
                          </div>
                          <div className="min-w-0 flex-1">
                            <h3 className="truncate font-medium">{item.title}</h3>
                            <p className="text-muted-foreground text-xs capitalize">
                              {item.is_owned ? "Already purchased" : item.item_type.toLowerCase()}
                            </p>
                          </div>
                          <div className="shrink-0 text-right">
                            {(() => {
                              if (item.is_owned) return <span className="font-semibold">Owned</span>;
                              const result = resolveCartItemPrice(item, effectiveCtx);
                              if (item.purchase_mode !== "FREE" && isUnavailablePrice(result)) {
                                return (
                                  <span className="text-xs text-muted-foreground">
                                    Not available for purchase
                                  </span>
                                );
                              }
                              const itemPrice = isResolvedPrice(result) ? result.amount : 0;
                              const itemCouponDiscount = cartItemCouponDiscount(item, effectiveCurrency);
                              const itemFinalPrice = itemPrice - itemCouponDiscount;
                              const itemOriginalPrice = isResolvedPrice(result) ? result.original : 0;
                              return (
                                <>
                                  <span className="font-semibold">
                                    {fmt(itemFinalPrice)}
                                  </span>
                                  {itemFinalPrice < itemOriginalPrice && itemOriginalPrice > 0 && (
                                    <p className="text-muted-foreground mt-0.5 text-xs line-through">
                                      {fmt(itemOriginalPrice)}
                                    </p>
                                  )}
                                  {/* Per-item coupon tag (read-only in checkout) */}
                                  {item.coupon_code && item.coupon_valid && itemCouponDiscount > 0 && (
                                    <div className="group relative mt-0.5 flex items-center justify-end gap-1">
                                      <Tag className="h-3.5 w-3.5 text-green-600 dark:text-green-400" />
                                      <span className="text-xs font-medium text-green-600 dark:text-green-400">
                                        {item.coupon_code} -{fmt(itemCouponDiscount)}
                                      </span>
                                      <div className="pointer-events-none absolute -top-8 right-0 z-10 hidden whitespace-nowrap rounded bg-foreground px-2 py-1 text-xs text-background group-hover:block">
                                        {item.coupon_code}: -{fmt(itemCouponDiscount)} off
                                      </div>
                                    </div>
                                  )}
                                  {/* Expired coupon warning (read-only) */}
                                  {item.coupon_code && !item.coupon_valid && (
                                    <div className="mt-0.5 flex items-center justify-end gap-1">
                                      <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />
                                      <span className="text-xs font-medium text-amber-600 dark:text-amber-400">
                                        {item.coupon_code} expired
                                      </span>
                                    </div>
                                  )}
                                </>
                              );
                            })()}
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Payment card */}
                    <div className="lg:sticky lg:top-24">
                      <div className="bg-card rounded-xl border p-6 shadow-sm">
                        <h2 className="mb-4 text-lg font-semibold">Payment Details</h2>

                        {/* Subtotal */}
                        <div className="space-y-3 border-b pb-4">
                          <div className="flex justify-between text-sm">
                            <span className="text-muted-foreground">
                              Subtotal ({purchasableItems.length} {purchasableItems.length === 1 ? "item" : "items"})
                            </span>
                            <span className="font-medium">
                              {fmt(checkoutSubtotal)}
                            </span>
                          </div>
                        </div>

                        {/* Tax line */}
                        {taxPercentage > 0 && (
                          <div className="space-y-1 border-b pb-3">
                            {taxMode === "EXCLUSIVE" ? (
                              <div className="flex justify-between text-sm">
                                <span className="text-muted-foreground">
                                  {summary.is_indian
                                    ? `CGST (${(taxPercentage / 2).toFixed(1)}%) + SGST (${(taxPercentage / 2).toFixed(1)}%)`
                                    : `Tax (${taxPercentage}%)`}
                                </span>
                                <span className="font-medium">
                                  {fmt(taxAmount)}
                                </span>
                              </div>
                            ) : (
                              <div className="flex justify-between text-xs">
                                <span className="text-muted-foreground">
                                  Incl. {summary.is_indian
                                    ? `CGST + SGST (${taxPercentage}%)`
                                    : `Tax (${taxPercentage}%)`}
                                </span>
                                <span className="text-muted-foreground">
                                  {fmt(taxAmount)}
                                </span>
                              </div>
                            )}
                          </div>
                        )}

                        {/* Total */}
                        <div className="flex justify-between py-4 text-base font-semibold">
                          <span>Total</span>
                          <span>{fmt(grandTotal)}</span>
                        </div>

                        {/* Forced default-currency notice */}
                        {forcedToDefault && (
                          <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-200">
                            Some items are not priced in {resolvedCurrency}. Your total is shown in {effectiveCurrency}.
                          </div>
                        )}

                        {/* Error message */}
                        {errorMessage && (
                          <div className="bg-destructive/10 text-destructive mb-4 rounded-lg p-3 text-sm">
                            {errorMessage}
                          </div>
                        )}

                        {/* Razorpay load error */}
                        {razorpayError && (
                          <div className="bg-destructive/10 text-destructive mb-4 rounded-lg p-3 text-sm">
                            Payment gateway could not be loaded. Please refresh and try again.
                          </div>
                        )}

                        {/* Suspended warning */}
                        {isSuspended && (
                          <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-200">
                            Purchases are temporarily unavailable. Please try again later.
                          </div>
                        )}

                        {/* Pay button */}
                        <button
                          type="button"
                          onClick={handlePayNow}
                          disabled={isBusy || !razorpayReady || purchasableItems.length === 0 || !canPurchase}
                          className={cn(
                            "text-primary-foreground flex w-full items-center justify-center gap-2 rounded-lg px-6 py-3 font-semibold transition-colors",
                            isBusy || !razorpayReady || purchasableItems.length === 0 || !canPurchase
                              ? "bg-primary/60 cursor-not-allowed"
                              : "bg-primary hover:bg-primary/90"
                          )}
                        >
                          {isBusy ? (
                            <>
                              <Loader2 className="h-5 w-5 animate-spin" />
                              {status === "creating_order" && "Creating order..."}
                              {status === "awaiting_payment" && "Awaiting payment..."}
                              {status === "verifying" && "Verifying payment..."}
                            </>
                          ) : (
                            <>
                              <Lock className="h-4 w-4" />
                              Pay Now
                            </>
                          )}
                        </button>

                        <p className="text-muted-foreground mt-3 text-center text-xs">
                          Secured by Razorpay. Your payment information is encrypted.
                        </p>

                        {/* Retry after failure */}
                        {status === "failed" && (
                          <button
                            type="button"
                            onClick={async () => {
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
                                  // Status check failed, fall through to retry
                                }
                              }
                              setStatus("idle");
                              setErrorMessage(null);
                            }}
                            className="hover:bg-muted mt-3 w-full rounded-lg border px-6 py-2 text-sm font-medium transition-colors"
                          >
                            Try Again
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </section>
        </LayoutWrapper>
      </AvailableRoutesProvider>
    </TenantThemeProvider>
  );
}
