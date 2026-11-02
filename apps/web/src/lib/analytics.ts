import posthog from "posthog-js";

/**
 * Analytics for the learner site.
 *
 * Three destinations, all optional and all fed from the same calls:
 *   - PostHog, our own product analytics
 *   - the tenant's Meta Pixel, when they have set a Pixel ID in SEO settings
 *   - the tenant's GTM container, through the dataLayer
 *
 * The Pixel script itself is injected in app/layout.tsx and only exists when
 * the tenant configured an ID and left analytics on, so every call here checks
 * for `window.fbq` first and quietly does nothing otherwise.
 */

declare global {
  interface Window {
    fbq?: (...args: unknown[]) => void;
    gtag?: (...args: unknown[]) => void;
    dataLayer?: Record<string, unknown>[];
  }
}

/** One thing being viewed, added or bought. */
export interface AnalyticsItem {
  id: string;
  name?: string;
  /** "COURSE", "BOOK", "BUNDLE"… Used as the GA4 item_category. */
  category?: string;
  /** Major units (rupees), never paise. */
  price?: number;
  quantity?: number;
}

/**
 * The commerce moments we report, named per platform.
 *
 * Meta and GA4 disagree about names and shapes, and each has its own
 * documented vocabulary, so the mapping is spelled out once here rather than
 * guessed at each call site:
 *
 *   ours            Meta Pixel          GA4 / GTM
 *   view            ViewContent         view_item
 *   add_to_cart     AddToCart           add_to_cart
 *   checkout        InitiateCheckout    begin_checkout
 *   purchase        Purchase            purchase
 *   subscribe       Subscribe           purchase (GA4 has no subscribe event)
 */
type CommerceMoment = "view" | "add_to_cart" | "checkout" | "purchase" | "subscribe";

const META_EVENT: Record<CommerceMoment, string> = {
  view: "ViewContent",
  add_to_cart: "AddToCart",
  checkout: "InitiateCheckout",
  purchase: "Purchase",
  subscribe: "Subscribe",
};

const GA4_EVENT: Record<CommerceMoment, string> = {
  view: "view_item",
  add_to_cart: "add_to_cart",
  checkout: "begin_checkout",
  purchase: "purchase",
  subscribe: "purchase",
};

/**
 * The Pixel snippet loads with `afterInteractive`, so a page that reports the
 * moment it mounts, the payment callback, which lands straight from the
 * gateway, can find `fbq` undefined. Retry briefly rather than dropping it.
 */
function whenPixelReady(run: () => void, attemptsLeft = 20): void {
  if (typeof window === "undefined") return;
  if (typeof window.fbq === "function") {
    run();
    return;
  }
  if (attemptsLeft <= 0) return;
  window.setTimeout(() => whenPixelReady(run, attemptsLeft - 1), 250);
}

/** True the first time this key is seen in the tab, false afterwards. */
function firstTime(key: string): boolean {
  if (!key) return true;
  try {
    if (window.sessionStorage.getItem(key)) return false;
    window.sessionStorage.setItem(key, "1");
  } catch {
    // Private mode or blocked storage: report it rather than lose it.
  }
  return true;
}

/**
 * Report one commerce moment to the tenant's Meta Pixel, their GTM container
 * and GA4. All three are injected independently in app/layout.tsx from their
 * own tenant setting, so each gets its own call and any of them may be absent.
 *
 * Values are MAJOR units (rupees). Callers divide the gateway's paise by 100;
 * sending minor units would report every sale at a hundred times its worth.
 */
function reportCommerce(
  moment: CommerceMoment,
  {
    items = [],
    value,
    currency,
    transactionId,
  }: { items?: AnalyticsItem[]; value?: number; currency?: string; transactionId?: string }
): void {
  if (typeof window === "undefined") return;

  const code = (currency || "INR").toUpperCase();
  const total = Number.isFinite(value) ? Number((value as number).toFixed(2)) : undefined;
  const ids = items.map((i) => i.id).filter(Boolean);

  /* ---- Meta Pixel ---------------------------------------------------- */
  // Standard events with Meta's own parameter names. `content_type: "product"`
  // is what makes content_ids match a catalogue, and value + currency are what
  // Meta requires to optimise and report on revenue.
  const metaParams: Record<string, unknown> = { content_type: "product" };
  if (ids.length) metaParams.content_ids = ids;
  if (items.length) {
    const first = items[0];
    if (items.length === 1 && first.name) metaParams.content_name = first.name;
    if (items.length === 1 && first.category) metaParams.content_category = first.category;
    if (moment === "checkout" || moment === "purchase") metaParams.num_items = items.length;
  }
  if (total !== undefined) {
    metaParams.value = total;
    metaParams.currency = code;
  }
  whenPixelReady(() => {
    try {
      // The order id doubles as the event id, so adding the Conversions API
      // later matches the two reports instead of counting both.
      window.fbq?.(
        "track",
        META_EVENT[moment],
        metaParams,
        transactionId ? { eventID: transactionId } : undefined
      );
    } catch {
      // fbq is third party code that an extension or a bad Pixel init can make
      // throw, and when the Pixel is already loaded this runs SYNCHRONOUSLY
      // inside the caller. The payment callback reports from inside a .then()
      // that has a .catch(), so an escaping throw there would flip a paid
      // order's screen to "Payment failed". A missed conversion is a reporting
      // gap; a buyer told their successful payment failed is a refund request.
    }
  });

  /* ---- GA4, through GTM and directly --------------------------------- */
  // GA4 ecommerce carries an `items` array; each entry uses GA4's own field
  // names (item_id, item_name, item_category, price, quantity).
  const ga4Items = items.map((i) => ({
    item_id: i.id,
    item_name: i.name,
    item_category: i.category,
    price: i.price,
    quantity: i.quantity ?? 1,
  }));
  const ga4Payload: Record<string, unknown> = {};
  if (transactionId) ga4Payload.transaction_id = transactionId;
  if (total !== undefined) {
    ga4Payload.value = total;
    ga4Payload.currency = code;
  }
  if (ga4Items.length) ga4Payload.items = ga4Items;

  try {
    window.dataLayer = window.dataLayer || [];
    // Google's documented practice: clear the previous ecommerce object first,
    // or values from the last event leak into this one.
    window.dataLayer.push({ ecommerce: null });
    window.dataLayer.push({ event: GA4_EVENT[moment], ecommerce: ga4Payload });
  } catch {
    // A blocked dataLayer must never break the page.
  }

  try {
    // GA4 loaded DIRECTLY, without a GTM container. gtag reads its own argument
    // queue, not the GTM style event object pushed above, so a tenant with a
    // GA4 id and no container would otherwise record nothing.
    window.gtag?.("event", GA4_EVENT[moment], ga4Payload);
  } catch {
    // Same reasoning as the dataLayer above.
  }
}

export function captureEvent(
  event: string,
  properties?: Record<string, string | number | boolean | undefined>
) {
  if (typeof window === "undefined") return;
  try {
    posthog.capture(event, properties);
  } catch {
    // Same rule as the Pixel above: analytics is fire and forget. This runs
    // FIRST inside every track function, so letting it throw would also cost
    // the Meta and GA4 reports that follow it.
  }
}

export function trackCourseViewed(courseId: string, courseSlug: string, tenantId?: string) {
  captureEvent("course_viewed", { course_id: courseId, course_slug: courseSlug, tenant_id: tenantId });
}

export function trackBookViewed(bookId: string, bookSlug: string, tenantId?: string) {
  captureEvent("book_viewed", { book_id: bookId, book_slug: bookSlug, tenant_id: tenantId });
}

/**
 * A product page was viewed: ViewContent for Meta, view_item for GA4.
 *
 * Ad platforms only. The pages that call this already report their own
 * PostHog event with the ids they have to hand, so reporting again here would
 * double count every page view in product analytics.
 */
export function trackProductViewed(item: AnalyticsItem, currency?: string) {
  reportCommerce("view", { items: [item], value: item.price, currency });
}

export function trackEnrollmentInitiated(courseId: string, source: string, tenantId?: string) {
  captureEvent("enrollment_initiated", { course_id: courseId, source, tenant_id: tenantId });
}

export function trackPaymentInitiated(
  orderId: string,
  amount: number,
  currency: string,
  tenantId?: string,
  items?: AnalyticsItem[]
) {
  captureEvent("payment_initiated", { order_id: orderId, amount, currency, tenant_id: tenantId });
  reportCommerce("checkout", { items: items ?? [], value: amount, currency, transactionId: orderId });
}

/**
 * A paid order went through. Reported to PostHog, to the tenant's Meta Pixel as
 * a standard `Purchase`, and to GTM and GA4 as `purchase`, so a tenant can
 * optimise ads on real revenue.
 *
 * `amount` is in MAJOR units (rupees) and `currency` is an ISO code such as
 * "INR". Every caller divides the gateway amount by 100 first.
 */
export function trackPaymentCompleted(
  orderId: string,
  amount: number,
  currency: string,
  tenantId?: string,
  items?: AnalyticsItem[]
) {
  captureEvent("payment_completed", { order_id: orderId, amount, currency, tenant_id: tenantId });
  if (typeof window === "undefined") return;
  // Verify and the status fallback both report success, and the callback page
  // re-verifies on a reload; each would otherwise count as its own conversion.
  if (!firstTime(`purchase-reported:${orderId}`)) return;
  reportCommerce("purchase", { items: items ?? [], value: amount, currency, transactionId: orderId });
}

/**
 * A paid recurring subscription became active. Meta has a dedicated `Subscribe`
 * event for this; GA4 has none, so it is reported there as a purchase, which is
 * what Google's own guidance recommends for a subscription sale.
 */
export function trackSubscriptionStarted(
  subscriptionId: string,
  planId: string,
  planName: string,
  amount: number,
  currency: string,
  tenantId?: string
) {
  captureEvent("subscription_started", {
    subscription_id: subscriptionId,
    plan_id: planId,
    amount,
    currency,
    tenant_id: tenantId,
  });
  if (typeof window === "undefined") return;
  // Activation is confirmed by polling, so this can run more than once.
  if (!firstTime(`subscribe-reported:${subscriptionId || planId}`)) return;
  reportCommerce("subscribe", {
    items: [{ id: planId, name: planName, category: "SUBSCRIPTION", price: amount }],
    value: amount,
    currency,
    transactionId: subscriptionId || planId,
  });
}

export function trackBookPurchase(bookId: string, tenantId?: string) {
  captureEvent("book_purchase", { book_id: bookId, tenant_id: tenantId });
}

export function trackUserSignup(method: string, tenantId?: string) {
  captureEvent("user_signup", { method, tenant_id: tenantId });
}

export function trackUserLogin(method: string, tenantId?: string) {
  captureEvent("user_login", { method, tenant_id: tenantId });
}

export function trackSearch(query: string, resultCount: number, tenantId?: string) {
  captureEvent("search_performed", { query, result_count: resultCount, tenant_id: tenantId });
}

export function trackAddToCart(
  itemId: string,
  itemType: string,
  tenantId?: string,
  details?: { name?: string; price?: number; currency?: string }
) {
  captureEvent("add_to_cart", { item_id: itemId, item_type: itemType, tenant_id: tenantId });
  reportCommerce("add_to_cart", {
    items: [{ id: itemId, name: details?.name, category: itemType, price: details?.price }],
    value: details?.price,
    currency: details?.currency,
  });
}
