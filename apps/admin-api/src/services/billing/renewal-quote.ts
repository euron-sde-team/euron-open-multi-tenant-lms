import type { billing_cycle } from "../../db/enums";

/**
 * Renewal of a plan that nothing renews on its own.
 *
 * WHY THIS EXISTS
 * ---------------
 * A subscription assigned from core-admin has no Razorpay subscription behind
 * it. When its period ends nothing charges, nothing expires, and nothing tells
 * the tenant, it simply stays ACTIVE. In October 2026 that was five paying
 * tenants, one of them ~90 days past its end date. The plans page could not
 * help either: it lists only Scale, so a Starter tenant could not even find its
 * own plan to pay for, and a Scale tenant saw "Current Plan" with no button.
 *
 * This file is the arithmetic only, pure, so it can be tested without a
 * database. The service decides who it applies to and talks to Razorpay.
 *
 * THE RULES (owner decisions, 2026-10-18)
 * ---------------------------------------
 * - Not yet expired: the tenant sets up autopay now, and the FIRST charge falls
 *   on their current expiry date. Nobody loses days they have already paid for.
 * - Expired: every cycle that has STARTED since expiry is collected now, as a
 *   one-time addon, and autopay resumes on the same billing day, so billing is
 *   continuous and every day is charged exactly once. (An expired trial owes
 *   nothing back; it just starts paying.)
 * - More than LOCK_AFTER_DAYS past expiry: the dashboard is locked until paid.
 * - Price = the tenant's OWN plan version (even if since retired), for their own
 *   billing cycle and currency, after that version's discount, plus 18% GST.
 *   the same figure the normal checkout charges.
 */

/** GST on top of the plan price. Same rate as the checkout and the invoices. */
export const RENEWAL_TAX_RATE = 0.18;

/** Show the "payment due" strip this many days before expiry. */
export const RENEWAL_NOTICE_DAYS = 30;

/** Lock the dashboard once this many days have passed since expiry, unpaid. */
export const RENEWAL_LOCK_AFTER_DAYS = 7;

/**
 * An autopay subscription is charged at its period end and the webhook lands
 * minutes later. When a charge FAILS, Razorpay keeps retrying for a few days
 * before it gives up (halted → our PAST_DUE + grace flow). Asking the tenant
 * to pay by hand during those retries risks a late retry charging them twice,
 * so an autopay only counts as lapsed once this long has passed with no charge.
 */
export const AUTOPAY_SETTLE_MS = 5 * 24 * 60 * 60 * 1000;

/**
 * Razorpay needs start_at in the future, and the payment link must close before
 * it. Closer to expiry than this, just charge now, the tenant loses under a day.
 */
export const MIN_DEFERRED_START_MS = 24 * 60 * 60 * 1000;

const DAY_MS = 24 * 60 * 60 * 1000;

export type RenewalState =
  /** Expiry is coming up: set up autopay, first charge on the expiry date. */
  | "DUE_SOON"
  /** Expired, inside the 7-day window: pay now, dashboard still open. */
  | "OVERDUE"
  /** Expired more than 7 days ago: dashboard locked until paid. */
  | "LOCKED";

export interface RenewalSubscriptionInput {
  status: string;
  billing_provider_name: string | null;
  external_subscription_id: string | null;
  current_period_end: Date;
  cancelled_at: Date | null;
  billing_cycle: billing_cycle;
}

export interface RenewalQuote {
  state: RenewalState;
  /** Whole days until expiry; negative once expired. */
  days_left: number;
  period_end: Date;
  /** When autopay takes its first regular charge. */
  charge_on: Date;
  /** Unix seconds for Razorpay's start_at, or null to start autopay immediately. */
  start_at: number | null;
  /** One cycle, before GST (after the plan version's own discount). */
  cycle_base: number;
  cycle_gst: number;
  /** One cycle including GST, what autopay charges every cycle. */
  cycle_total: number;
  /** Cycles started since expiry and not paid for (only when expired). */
  back_due_cycles: number;
  /** back_due_cycles × cycle_total. */
  back_due_total: number;
  /**
   * Charged the moment they approve: back dues, plus the current cycle when
   * autopay starts immediately. 0 when the first charge is simply deferred.
   */
  first_charge_total: number;
  /** The span the back dues cover, for the invoice and the strip. */
  back_due_from: Date | null;
  back_due_to: Date | null;
}

/** Money to 2 decimals, the way the checkout rounds it. */
export function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/** One cycle including GST, identical to the checkout's Razorpay plan amount. */
export function withGst(base: number): number {
  return base > 0 ? round2(base * (1 + RENEWAL_TAX_RATE)) : 0;
}

/**
 * Advance a date by n billing cycles, in calendar months (UTC).
 *
 * Clamped to the end of the target month: plain setMonth() turns 31 Jan + 1
 * month into 3 March, which would skip February when counting what's owed.
 */
export function addCycles(from: Date, cycle: billing_cycle, n: number): Date {
  const months = cycle === "TWO_YEARLY" ? 24 * n : cycle === "YEARLY" ? 12 * n : n;
  const d = new Date(from);
  const day = d.getUTCDate();
  d.setUTCDate(1);
  d.setUTCMonth(d.getUTCMonth() + months);
  const lastDay = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate();
  d.setUTCDate(Math.min(day, lastDay));
  return d;
}

/** How many whole cycles fit between `from` and `now`. */
export function wholeCyclesBetween(from: Date, now: Date, cycle: billing_cycle): number {
  let n = 0;
  // Bounded: 120 monthly cycles is ten years; nothing real is that far behind.
  while (n < 120 && addCycles(from, cycle, n + 1) <= now) n++;
  return n;
}

/**
 * Does this subscription need a manual renewal at all?
 *
 * No for: free plans (they never pay a plan fee), anything
 * not ACTIVE/TRIALING (PAST_DUE has its own autopay-failure banner and grace;
 * CANCELLED/EXPIRED get the "Subscription Ended" screen), a scheduled
 * cancellation (they chose to leave), and a healthy autopay.
 */
export function needsManualRenewal(sub: RenewalSubscriptionInput, now: Date): boolean {
  if (sub.status !== "ACTIVE" && sub.status !== "TRIALING") return false;
  const provider = (sub.billing_provider_name ?? "").toUpperCase();
  if (provider === "FREE") return false;
  if (sub.cancelled_at) return false;

  const hasAutopay =
    !!sub.external_subscription_id && (provider === "RAZORPAY" || provider === "STRIPE");
  if (hasAutopay) {
    // Autopay renews itself. Only once it is well past its end date with no
    // charge recorded has it lapsed and needs the tenant.
    return sub.current_period_end.getTime() < now.getTime() - AUTOPAY_SETTLE_MS;
  }
  return true;
}

/**
 * The quote, or null when nothing is due yet (more than RENEWAL_NOTICE_DAYS
 * away) or the plan costs nothing.
 */
export function buildRenewalQuote(
  sub: RenewalSubscriptionInput,
  cycleBase: number,
  now: Date
): RenewalQuote | null {
  if (!needsManualRenewal(sub, now)) return null;

  const cycleTotal = withGst(cycleBase);
  if (cycleTotal <= 0) return null;

  const end = sub.current_period_end;
  const msLeft = end.getTime() - now.getTime();
  const daysLeft = msLeft >= 0 ? Math.ceil(msLeft / DAY_MS) : -Math.floor(-msLeft / DAY_MS);

  if (msLeft > RENEWAL_NOTICE_DAYS * DAY_MS) return null;

  const base = {
    days_left: daysLeft,
    period_end: end,
    cycle_base: round2(cycleBase),
    cycle_gst: round2(cycleTotal - cycleBase),
    cycle_total: cycleTotal,
  };

  if (msLeft > 0) {
    // Not expired yet. Defer the first charge to the expiry date, unless that
    // is too close for Razorpay to schedule, in which case charge now.
    const defer = msLeft >= MIN_DEFERRED_START_MS;
    return {
      ...base,
      state: "DUE_SOON",
      charge_on: defer ? end : now,
      start_at: defer ? Math.floor(end.getTime() / 1000) : null,
      back_due_cycles: 0,
      back_due_total: 0,
      first_charge_total: defer ? 0 : cycleTotal,
      back_due_from: null,
      back_due_to: null,
    };
  }

  const overdueDays = Math.floor(-msLeft / DAY_MS);
  const state: RenewalState = overdueDays > RENEWAL_LOCK_AFTER_DAYS ? "LOCKED" : "OVERDUE";

  // A trial was never paid for, so there is nothing "missed" to collect: an
  // expired trial simply starts paying today.
  if (sub.status === "TRIALING") {
    return {
      ...base,
      state,
      charge_on: now,
      start_at: null,
      back_due_cycles: 0,
      back_due_total: 0,
      first_charge_total: cycleTotal,
      back_due_from: null,
      back_due_to: null,
    };
  }

  // Billing stays continuous from the old expiry: they owe every cycle that
  // has STARTED since then, and autopay resumes on the same billing day.
  //
  //   expired 18 Jul, today 18 Oct morning → cycles started: Jul, Aug, Sep → 3
  //   paid-through after the back dues: 18 Oct (the anchor)
  //
  // Counting only WHOLE cycles (my first cut) charged 2 here and quietly gave
  // away 18 Sep–18 Oct. Rounding up to "started" and resuming on the anchor
  // charges every day exactly once.
  const backCycles = wholeCyclesBetween(end, now, sub.billing_cycle) + 1;
  const anchor = addCycles(end, sub.billing_cycle, backCycles); // > now, < 1 cycle away
  const backTotal = round2(backCycles * cycleTotal);

  // Autopay's first charge on the anchor, unless the anchor is too close for
  // Razorpay to schedule, then the current cycle is charged now too (an
  // overlap of under a day, never a free cycle).
  const defer = anchor.getTime() - now.getTime() >= MIN_DEFERRED_START_MS;

  return {
    ...base,
    state,
    charge_on: defer ? anchor : now,
    start_at: defer ? Math.floor(anchor.getTime() / 1000) : null,
    back_due_cycles: backCycles,
    back_due_total: backTotal,
    // Charged when they approve: the back dues, plus this cycle if not deferred.
    first_charge_total: defer ? backTotal : round2(backTotal + cycleTotal),
    back_due_from: end,
    back_due_to: anchor,
  };
}
