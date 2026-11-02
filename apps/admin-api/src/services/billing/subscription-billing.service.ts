import { ulid } from "ulid";
import { sql, type Transaction } from "kysely";
import { db } from "../../db/connection";
import type { DB } from "../../db/types";
import { BadRequestError } from "../../errors/bad-request.error";
import { NotFoundError } from "../../errors/not-found.error";
import { findProviderByName } from "../../repositories/billing-providers.repository";
import entitlementsRepository from "../../repositories/entitlements.repository";
import pendingSubscriptionCheckoutRepository from "../../repositories/pending-subscription-checkout.repository";
import planVersionBillingMappingRepository from "../../repositories/plan-version-billing-mapping.repository";
import plansRepository from "../../repositories/plans.repository";
import subscriptionRepository from "../../repositories/subscription.repository";
import subscriptionEventsRepository from "../../repositories/subscription-events.repository";
import config from "../../config";
import logger from "../../utils/logger";
import { getBillingGatewayAdapter, type BillingProviderName } from "./billing-gateway.factory";
import { queueSubscriptionNotification } from "../../queues/subscription-notification.queue";
import usageService from "../usage.service";
import { invoiceExists, getInvoicePublicUrl } from "../../utils/s3.invoice.util";
import type { billing_cycle } from "../../db/enums";
import { buildRenewalQuote, type RenewalQuote } from "./renewal-quote";

const GRACE_PERIOD_DAYS = 7;

/** GST rate applied on top of base plan price for Razorpay billing and price snapshots. */
const TAX_RATE = 0.18;

/** Subscription duration in years. Razorpay supports up to 100 years. */
const SUBSCRIPTION_DURATION_YEARS = 10;

/** Billing cycles for 10-year subscription: MONTHLY = 120, YEARLY = 10 */
const TOTAL_COUNT_BY_CYCLE: Record<billing_cycle, number> = {
  MONTHLY: SUBSCRIPTION_DURATION_YEARS * 12,
  YEARLY: SUBSCRIPTION_DURATION_YEARS,
  TWO_YEARLY: Math.floor(SUBSCRIPTION_DURATION_YEARS / 2),
};

export interface CreateCheckoutParams {
  plan_version_id: string;
  billing_cycle: billing_cycle;
  currency: "INR" | "USD";
  trial_days?: number;
  provider?: BillingProviderName;
}

export interface CreateCheckoutResult {
  subscription_id: string;
  short_url: string;
  key_id: string;
}

/** What the "payment due" strip and the renewal card show. */
export interface RenewalStatus extends RenewalQuote {
  subscription_id: string;
  plan_version_id: string;
  plan_name: string;
  billing_cycle: billing_cycle;
  currency: "INR" | "USD";
}

export interface CreateRenewalResult extends CreateCheckoutResult {
  first_charge_total: number;
  charge_on: Date;
  currency: "INR" | "USD";
}

export interface EligibilityConflict {
  product_code: string;
  feature_name: string;
  current_used: number;
  new_limit: number;
  unit: string | null;
}

export interface EligibilityResult {
  can_subscribe: boolean;
  is_upgrade: boolean;
  is_downgrade: boolean;
  conflicts?: EligibilityConflict[];
  current_subscription?: {
    id: string;
    plan_version_id: string;
    plan_name: string;
    status: string;
  };
  trial_available?: boolean;
}

class SubscriptionBillingService {
  /**
   * Get or create external plan ID for the given plan version + billing cycle + currency.
   * On-demand: creates in provider if not in mapping table, then caches.
   */
  async getOrCreateExternalPlan(
    planVersionId: string,
    billingCycle: billing_cycle,
    currency: "INR" | "USD",
    tenantId: string,
    providerName: BillingProviderName = "RAZORPAY"
  ): Promise<string> {
    const provider = await findProviderByName(providerName);
    if (!provider) {
      throw new BadRequestError(`${providerName} billing provider is not configured`);
    }

    const existing = await planVersionBillingMappingRepository.find(
      planVersionId,
      provider.id,
      billingCycle,
      currency
    );
    if (existing?.external_plan_id) {
      return existing.external_plan_id;
    }

    const planVersion = await plansRepository.getPlanVersionById(planVersionId);
    if (!planVersion) {
      throw new NotFoundError(`Plan version '${planVersionId}' not found`);
    }

    const basePrice = plansRepository.getPrice(planVersion, billingCycle, currency);
    const taxInclusivePrice = basePrice > 0 ? Math.round(basePrice * (1 + TAX_RATE) * 100) / 100 : 0;
    const amountInSmallestUnit = Math.round(taxInclusivePrice * 100);

    const adapter = getBillingGatewayAdapter(providerName);
    const result = await adapter.createPlan({
      period: billingCycle === "MONTHLY" ? "monthly" : "yearly",
      interval: billingCycle === "TWO_YEARLY" ? 2 : 1,
      item: {
        name: planVersion.plan_name,
        amount: amountInSmallestUnit,
        currency,
      },
    });

    const finalExternalPlanId = await planVersionBillingMappingRepository.upsert({
      plan_version_id: planVersionId,
      billing_provider_id: provider.id,
      billing_cycle: billingCycle,
      currency,
      external_plan_id: result.id,
    });

    return finalExternalPlanId;
  }

  /**
   * Create checkout session for tenant subscription purchase.
   */
  async createCheckout(
    tenantId: string,
    params: CreateCheckoutParams
  ): Promise<CreateCheckoutResult> {
    const { plan_version_id, billing_cycle, currency, trial_days = 0, provider: providerName = "RAZORPAY" } = params;

    const planVersion = await plansRepository.getPlanVersionById(plan_version_id);
    if (!planVersion) {
      throw new NotFoundError(`Plan version '${plan_version_id}' not found`);
    }

    if (!planVersion.is_active) {
      throw new BadRequestError("This plan version is not available for purchase");
    }

    if (!planVersion.published_at) {
      throw new BadRequestError("This plan version is not published and cannot be purchased");
    }

    if (planVersion.pricing_frequency === "MONTHLY" && billing_cycle !== "MONTHLY") {
      throw new BadRequestError("This plan version only supports monthly billing");
    }
    if (planVersion.pricing_frequency === "YEARLY" && billing_cycle !== "YEARLY") {
      throw new BadRequestError("This plan version only supports yearly billing");
    }
    if (planVersion.pricing_frequency === "TWO_YEARLY" && billing_cycle !== "TWO_YEARLY") {
      throw new BadRequestError("This plan version only supports two-yearly billing");
    }
    if (planVersion.pricing_frequency === "BOTH" && billing_cycle !== "MONTHLY" && billing_cycle !== "YEARLY" && billing_cycle !== "TWO_YEARLY") {
      throw new BadRequestError("This plan version supports monthly, yearly, or two-yearly billing only");
    }
    // ALL supports all three cycles, no restriction needed

    const eligibility = await this.checkEligibility(tenantId, plan_version_id, currency);
    if (!eligibility.can_subscribe && eligibility.conflicts && eligibility.conflicts.length > 0) {
      throw new BadRequestError(
        `Cannot subscribe: current usage exceeds new plan limits. ${JSON.stringify(eligibility.conflicts)}`
      );
    }

    const externalPlanId = await this.getOrCreateExternalPlan(
      plan_version_id,
      billing_cycle,
      currency,
      tenantId,
      providerName
    );

    const provider = await findProviderByName(providerName);
    if (!provider) {
      throw new BadRequestError(`${providerName} billing provider is not configured`);
    }

    const adapter = getBillingGatewayAdapter(providerName);
    const totalCount = TOTAL_COUNT_BY_CYCLE[billing_cycle];
    const nowSec = Math.floor(Date.now() / 1000);
    let startAt: number | undefined;
    if (trial_days > 0) {
      startAt = nowSec + trial_days * 24 * 60 * 60;
    }
    // Checkout link valid for 48 hours
    const expireBy = nowSec + 48 * 60 * 60;

    const externalSub = await adapter.createSubscription({
      plan_id: externalPlanId,
      total_count: totalCount,
      start_at: startAt,
      expire_by: expireBy,
      notes: {
        tenant_id: tenantId,
        plan_version_id,
        billing_cycle,
        currency,
        trial_days: String(trial_days),
      },
    });

    await pendingSubscriptionCheckoutRepository.create({
      id: ulid(),
      tenant_id: tenantId,
      external_subscription_id: externalSub.id,
      plan_version_id,
      billing_cycle,
      currency,
      billing_provider_name: providerName,
    });

    const keyId = providerName === "RAZORPAY" ? config.CORE_RAZORPAY_KEY_ID : config.CORE_STRIPE_PUBLISHABLE_KEY;

    return {
      subscription_id: externalSub.id,
      short_url: externalSub.short_url ?? "",
      key_id: keyId,
    };
  }

  /**
   * Is a payment due on the tenant's current plan, and how much?
   *
   * Null when nothing is due: autopay is healthy, the plan is free,
   * or expiry is more than RENEWAL_NOTICE_DAYS away. The rules
   * live in renewal-quote.ts.
   */
  async getRenewalStatus(tenantId: string, now = new Date()): Promise<RenewalStatus | null> {
    const sub = await subscriptionRepository.findCurrentByTenant(tenantId);
    if (!sub) return null;
    if (sub.currency !== "INR" && sub.currency !== "USD") return null;

    // The tenant's OWN plan version, retired or not. They are renewing what
    // they have, at that version's price; the catalogue moving on doesn't
    // change what they signed up for.
    const planVersion = await plansRepository.getPlanVersionById(sub.plan_version_id);
    if (!planVersion || planVersion.purchase_mode === "FREE") return null;

    const base = plansRepository.getPrice(planVersion, sub.billing_cycle, sub.currency);
    const quote = buildRenewalQuote(sub, base, now);
    if (!quote) return null;

    return {
      ...quote,
      subscription_id: sub.id,
      plan_version_id: sub.plan_version_id,
      plan_name: planVersion.plan_name,
      billing_cycle: sub.billing_cycle,
      currency: sub.currency,
    };
  }

  /**
   * Start the Razorpay payment that renews the tenant's current plan.
   *
   * Same machinery as a new purchase (a Razorpay subscription, confirmed by
   * webhook), so autopay carries on afterwards. Differences:
   *   - the plan is the tenant's own version, even if retired;
   *   - not expired yet → `start_at` = expiry, so the first charge lands on the
   *     day the paid period ends, not today;
   *   - expired → charged now, with whole missed cycles as a one-time addon;
   *   - no usage-conflict check: they are renewing the plan they are on.
   */
  async createRenewalCheckout(tenantId: string, now = new Date()): Promise<CreateRenewalResult> {
    const status = await this.getRenewalStatus(tenantId, now);
    if (!status) {
      throw new BadRequestError("Your plan does not need a renewal payment right now");
    }

    const providerName: BillingProviderName = "RAZORPAY";
    const provider = await findProviderByName(providerName);
    if (!provider) {
      throw new BadRequestError(`${providerName} billing provider is not configured`);
    }
    const adapter = getBillingGatewayAdapter(providerName);

    const planId = await this.resolveRenewalPlanId(status, adapter, tenantId);

    const nowSec = Math.floor(now.getTime() / 1000);
    // The link must close before a deferred first charge. renewal-quote only
    // defers when expiry is at least a day away, so this stays positive.
    const expireBy = status.start_at
      ? Math.min(nowSec + 48 * 60 * 60, status.start_at - 60 * 60)
      : nowSec + 48 * 60 * 60;

    const unit =
      status.billing_cycle === "MONTHLY"
        ? "month"
        : status.billing_cycle === "YEARLY"
          ? "year"
          : "cycle";
    const addons =
      status.back_due_cycles > 0
        ? [
            {
              item: {
                name: `${status.plan_name}: ${status.back_due_cycles} overdue ${unit}${status.back_due_cycles > 1 ? "s" : ""}`.slice(0, 100),
                amount: Math.round(status.back_due_total * 100),
                currency: status.currency,
              },
            },
          ]
        : undefined;

    const notes: Record<string, string> = {
      tenant_id: tenantId,
      plan_version_id: status.plan_version_id,
      billing_cycle: status.billing_cycle,
      currency: status.currency,
      trial_days: "0",
      kind: "RENEWAL",
      renews_subscription_id: status.subscription_id,
      start_at: status.start_at ? String(status.start_at) : "",
      cycle_total: String(status.cycle_total),
      back_due_cycles: String(status.back_due_cycles),
      back_due_total: String(status.back_due_total),
      back_due_from: status.back_due_from?.toISOString() ?? "",
      back_due_to: status.back_due_to?.toISOString() ?? "",
      first_charge_total: String(status.first_charge_total),
    };

    const externalSub = await adapter.createSubscription({
      plan_id: planId,
      total_count: TOTAL_COUNT_BY_CYCLE[status.billing_cycle],
      start_at: status.start_at ?? undefined,
      expire_by: expireBy,
      notes,
      addons,
    });

    await pendingSubscriptionCheckoutRepository.create({
      id: ulid(),
      tenant_id: tenantId,
      external_subscription_id: externalSub.id,
      plan_version_id: status.plan_version_id,
      billing_cycle: status.billing_cycle,
      currency: status.currency,
      billing_provider_name: providerName,
    });

    await this.recordSubscriptionEvent(
      status.subscription_id,
      tenantId,
      "RENEWAL_CHECKOUT_CREATED",
      "API",
      null,
      {
        external_subscription_id: externalSub.id,
        state: status.state,
        first_charge_total: status.first_charge_total,
        back_due_cycles: status.back_due_cycles,
        charge_on: status.charge_on.toISOString(),
      }
    );

    return {
      subscription_id: externalSub.id,
      short_url: externalSub.short_url ?? "",
      key_id: config.CORE_RAZORPAY_KEY_ID,
      first_charge_total: status.first_charge_total,
      charge_on: status.charge_on,
      currency: status.currency,
    };
  }

  /**
   * The Razorpay plan to renew on, one whose amount is EXACTLY what we quote.
   *
   * Razorpay plans are created once per version/cycle/currency and cached. GST
   * was only added to that amount on 2026-03-18; a plan cached in the three
   * weeks before would charge the price WITHOUT GST, while the strip says
   * otherwise. Check what Razorpay will actually charge, and if it disagrees,
   * create a correctly-priced plan for this renewal rather than ask a tenant to
   * pay a number we didn't show them. The shared cache is left alone.
   */
  private async resolveRenewalPlanId(
    status: RenewalStatus,
    adapter: ReturnType<typeof getBillingGatewayAdapter>,
    tenantId: string
  ): Promise<string> {
    const cachedId = await this.getOrCreateExternalPlan(
      status.plan_version_id,
      status.billing_cycle,
      status.currency,
      tenantId,
      "RAZORPAY"
    );

    const expectedAmount = Math.round(status.cycle_total * 100);
    const expectedPeriod = status.billing_cycle === "MONTHLY" ? "monthly" : "yearly";
    const expectedInterval = status.billing_cycle === "TWO_YEARLY" ? 2 : 1;

    const plan = await adapter.fetchPlan(cachedId);
    if (
      plan.amount === expectedAmount &&
      plan.currency === status.currency &&
      plan.period === expectedPeriod &&
      plan.interval === expectedInterval
    ) {
      return cachedId;
    }

    logger.warn(
      `[subscription-billing] Renewal: cached Razorpay plan ${cachedId} charges ` +
        `${plan.amount} ${plan.currency} ${plan.period}/${plan.interval}, expected ` +
        `${expectedAmount} ${status.currency} ${expectedPeriod}/${expectedInterval}, ` +
        `creating a correctly priced plan for tenant=${tenantId}`
    );
    const fresh = await adapter.createPlan({
      period: expectedPeriod,
      interval: expectedInterval,
      item: { name: status.plan_name, amount: expectedAmount, currency: status.currency },
    });
    return fresh.id;
  }

  /**
   * Check eligibility for a plan (upgrade/downgrade, conflicts).
   */
  async checkEligibility(
    tenantId: string,
    planVersionId: string,
    _currency?: string
  ): Promise<EligibilityResult> {
    const planVersion = await plansRepository.getPlanVersionById(planVersionId);
    if (!planVersion) {
      return { can_subscribe: false, is_upgrade: false, is_downgrade: false };
    }

    const currentSub = await subscriptionRepository.findBlockingByTenant(tenantId);
    const newProducts = await subscriptionRepository.getPlanVersionProducts(planVersionId);

    if (!currentSub) {
      return {
        can_subscribe: true,
        is_upgrade: false,
        is_downgrade: false,
        trial_available: true,
      };
    }

    // Read actual usage from counters (subscription-independent)
    const usageMap = await usageService.getAllUsage(tenantId);
    const rawConflicts: Array<{ product_code: string; current_used: number; new_limit: number }> = [];

    for (const pvp of newProducts) {
      const used = usageMap.get(pvp.product_code) ?? 0;
      if (!pvp.is_unlimited && used > pvp.limit_value) {
        rawConflicts.push({
          product_code: pvp.product_code,
          current_used: used,
          new_limit: pvp.limit_value,
        });
      }
    }

    // Enrich conflicts with human-readable names
    let conflicts: EligibilityConflict[] | undefined;
    if (rawConflicts.length > 0) {
      const nameMap = await plansRepository.resolveProductNames(
        rawConflicts.map((c) => c.product_code)
      );
      conflicts = rawConflicts.map((c) => {
        const info = nameMap.get(c.product_code);
        return {
          product_code: c.product_code,
          feature_name: info?.feature_name ?? c.product_code,
          current_used: c.current_used,
          new_limit: c.new_limit,
          unit: info?.unit ?? null,
        };
      });
    }

    const canSubscribe = rawConflicts.length === 0;
    const isUpgrade = false;
    const isDowngrade = false;

    return {
      can_subscribe: canSubscribe,
      is_upgrade: isUpgrade,
      is_downgrade: isDowngrade,
      conflicts,
      current_subscription: {
        id: currentSub.id,
        plan_version_id: currentSub.plan_version_id,
        plan_name: currentSub.plan_name_snapshot,
        status: currentSub.status,
      },
    };
  }

  /**
   * Process webhook event from billing provider (Razorpay).
   */
  async processWebhookEvent(
    event: string,
    eventId: string,
    payload: Record<string, unknown>,
    providerName: BillingProviderName = "RAZORPAY"
  ): Promise<void> {
    // Razorpay: payload.subscription.entity.id (or payload.subscription.id in some variants)
    const subWrapper = payload?.subscription as
      | { entity?: { id?: string }; id?: string }
      | undefined;
    const externalSubId =
      (subWrapper?.entity?.id as string | undefined) ??
      (subWrapper?.id as string | undefined);
    if (!externalSubId) {
      logger.warn(
        `${providerName} webhook: no subscription id in payload event=${event} eventId=${eventId} payloadKeys=${Object.keys(payload ?? {}).join(",")}`
      );
      return;
    }

    // Extract payment ID from webhook payload
    const paymentWrapper = payload?.payment as { entity?: { id?: string } } | undefined;
    const paymentId = (paymentWrapper?.entity?.id as string | undefined) ?? undefined;

    const existingSub = await subscriptionRepository.findByExternalId(externalSubId);
    const subscriptionPayload = (subWrapper?.entity ?? subWrapper) as
      | Record<string, unknown>
      | undefined;

    switch (event) {
      case "subscription.authenticated":
      case "subscription.activated": {
        await pendingSubscriptionCheckoutRepository.deleteByExternalId(externalSubId);
        if (existingSub) {
          if (existingSub.status !== "CANCELLED" && existingSub.status !== "EXPIRED") {
            // Active/trialing sub, just update status
            await subscriptionRepository.update(existingSub.id, {
              status: "ACTIVE",
              external_subscription_id: externalSubId,
              updated_at: new Date(),
            });
            await this.recordSubscriptionEvent(
              existingSub.id,
              existingSub.tenant_id,
              event === "subscription.activated" ? "ACTIVATED" : "CREATED",
              "WEBHOOK",
              eventId
            );
            // Ensure tenant is ACTIVE, poll reconciliation may have created the sub
            // but a subsequent subscription.cancelled webhook re-suspended the tenant
            await this.updateTenantStatus(existingSub.tenant_id, "ACTIVE");
            return;
          }
          // CANCELLED/EXPIRED, fall through to re-subscribe
        }
        const notes = (subscriptionPayload?.notes as Record<string, string>) || {};
        const tenantId = notes.tenant_id || existingSub?.tenant_id;
        const planVersionId = notes.plan_version_id || existingSub?.plan_version_id;
        if (!tenantId || !planVersionId) {
          logger.warn(
            `${providerName} webhook: missing tenant_id or plan_version_id in notes event=${event} externalSubId=${externalSubId} notesKeys=${Object.keys(notes).join(",")}`
          );
          return;
        }
        const isTrialing =
          event === "subscription.authenticated" &&
          subscriptionPayload?.status === "authenticated";
        await this.createSubscriptionFromWebhook(
          tenantId,
          planVersionId,
          externalSubId,
          subscriptionPayload,
          isTrialing,
          notes,
          providerName,
          paymentId
        );
        break;
      }
      case "subscription.charged": {
        await pendingSubscriptionCheckoutRepository.deleteByExternalId(externalSubId);
        const currentStart = subscriptionPayload?.current_start as number | undefined;
        const currentEnd = subscriptionPayload?.current_end as number | undefined;

        // Charged event should ONLY update an existing active/trialing subscription.
        // Subscription creation is handled exclusively by subscription.authenticated/activated.
        // This prevents duplicate subscriptions from race conditions when both webhooks
        // arrive near-simultaneously.

        // If existingSub wasn't found initially (race with authenticated), retry once
        let chargedSub = existingSub;
        if (!chargedSub) {
          // Wait briefly for authenticated handler to commit, then retry
          await new Promise((resolve) => setTimeout(resolve, 2000));
          chargedSub = await subscriptionRepository.findByExternalId(externalSubId);
        }

        if (!chargedSub) {
          logger.warn(
            `${providerName} webhook: subscription not found for charged event externalSubId=${externalSubId}, skipping (authenticated event will handle creation)`
          );
          break;
        }

        // If subscription is CANCELLED/EXPIRED, the authenticated/activated event
        // handles reactivation. Charged just needs to update period dates.
        // Re-read in case authenticated handler just reactivated it.
        if (chargedSub.status === "CANCELLED" || chargedSub.status === "EXPIRED") {
          const freshSub = await subscriptionRepository.findByExternalId(externalSubId);
          if (freshSub && freshSub.status !== "CANCELLED" && freshSub.status !== "EXPIRED") {
            chargedSub = freshSub;
          } else {
            logger.info(
              `${providerName} webhook: subscription ${externalSubId} is ${chargedSub.status}, charged event skipping, authenticated will handle reactivation`
            );
            break;
          }
        }

        const wasPastDue = chargedSub.status === "PAST_DUE";
        await subscriptionRepository.update(chargedSub.id, {
          status: "ACTIVE",
          current_period_start: currentStart ? new Date(currentStart * 1000) : undefined,
          current_period_end: currentEnd ? new Date(currentEnd * 1000) : undefined,
          grace_period_ends_at: null,
          dunning_started_at: null,
          last_payment_attempt_at: null,
          payment_failure_count: 0,
          updated_at: new Date(),
        });
        await this.recordSubscriptionEvent(
          chargedSub.id,
          chargedSub.tenant_id,
          "CHARGED",
          "WEBHOOK",
          eventId
        );
        // Always ensure tenant is ACTIVE when a charge succeeds.
        await this.updateTenantStatus(chargedSub.tenant_id, "ACTIVE");
        if (wasPastDue) {
          await queueSubscriptionNotification({
            type: "PAYMENT_RECOVERED",
            tenantId: chargedSub.tenant_id,
            subscriptionId: chargedSub.id,
          });
        } else {
          // Safety net: if this is a new purchase charge (not past-due recovery),
          // check whether a purchase notification was already sent. The primary path
          // is createSubscriptionFromWebhook (via authenticated/activated), but if
          // that was skipped (sub already ACTIVE race), no notification gets queued.
          try {
            const existingEvents = await subscriptionEventsRepository.findBySubscriptionAndType(
              chargedSub.id,
              "NOTIFICATION_SENT"
            );
            const alreadySentPurchase = existingEvents.some(
              (e) => {
                const notifType = (e.metadata as Record<string, unknown>)?.notification_type;
                return notifType === "PLAN_PURCHASED" || notifType === "REACTIVATION_CONFIRMED";
              }
            );
            if (!alreadySentPurchase) {
              logger.info(
                `[subscription-billing] Safety net: no PLAN_PURCHASED/REACTIVATION_CONFIRMED notification found for sub=${chargedSub.id}, queueing PLAN_PURCHASED`
              );
              await queueSubscriptionNotification(
                {
                  type: "PLAN_PURCHASED",
                  tenantId: chargedSub.tenant_id,
                  subscriptionId: chargedSub.id,
                  metadata: {
                    planName: chargedSub.plan_name_snapshot ?? "Unknown",
                    billingCycle: chargedSub.billing_cycle ?? "MONTHLY",
                    currency: chargedSub.currency ?? "INR",
                    price: String(chargedSub.price_snapshot ?? 0),
                    externalSubscriptionId: chargedSub.external_subscription_id ?? undefined,
                    paymentId,
                  },
                },
                { forceNew: true }
              );
            } else {
              logger.info(
                `[subscription-billing] Safety net: notification already sent for sub=${chargedSub.id}, skipping`
              );
            }
          } catch (err) {
            logger.warn(
              `[subscription-billing] Safety net notification check failed for sub=${chargedSub.id}: ${(err as Error).message}`
            );
          }
        }
        break;
      }
      case "subscription.pending": {
        if (!existingSub) return;
        if (existingSub.status === "CANCELLED" || existingSub.status === "EXPIRED") return;
        await subscriptionRepository.update(existingSub.id, {
          last_payment_attempt_at: new Date(),
          payment_failure_count: (existingSub.payment_failure_count || 0) + 1,
          updated_at: new Date(),
        });
        await this.recordSubscriptionEvent(
          existingSub.id, existingSub.tenant_id, "PAYMENT_PENDING", "WEBHOOK", eventId
        );
        await queueSubscriptionNotification({
          type: "PAYMENT_FAILED",
          tenantId: existingSub.tenant_id,
          subscriptionId: existingSub.id,
          metadata: { is_pending: true },
        });
        break;
      }
      case "subscription.halted": {
        if (!existingSub) return;
        if (existingSub.status === "CANCELLED" || existingSub.status === "EXPIRED") return;
        const graceDays = await this.resolveGracePeriodDays(existingSub.plan_version_id);
        const graceEndsAt = new Date();
        graceEndsAt.setDate(graceEndsAt.getDate() + graceDays);
        await subscriptionRepository.update(existingSub.id, {
          status: "PAST_DUE",
          grace_period_ends_at: graceEndsAt,
          dunning_started_at: new Date(),
          last_payment_attempt_at: new Date(),
          payment_failure_count: (existingSub.payment_failure_count || 0) + 1,
          updated_at: new Date(),
        });
        await this.recordSubscriptionEvent(
          existingSub.id,
          existingSub.tenant_id,
          "HALTED",
          "WEBHOOK",
          eventId
        );
        await this.recordSubscriptionEvent(
          existingSub.id,
          existingSub.tenant_id,
          "GRACE_STARTED",
          "SYSTEM",
          null,
          { grace_days: graceDays, grace_ends_at: graceEndsAt.toISOString() }
        );
        // Queue payment failed notification
        await queueSubscriptionNotification({
          type: "PAYMENT_FAILED",
          tenantId: existingSub.tenant_id,
          subscriptionId: existingSub.id,
          metadata: { grace_days: graceDays },
        });
        break;
      }
      case "subscription.cancelled":
      case "subscription.completed": {
        await pendingSubscriptionCheckoutRepository.deleteByExternalId(externalSubId);
        if (!existingSub) {
          logger.warn(
            `${providerName} webhook: subscription not found for ${event} externalSubId=${externalSubId} - may have been cancelled via API`
          );
          return;
        }
        const cancelTenantId = existingSub.tenant_id;
        const cancelStatus = event === "subscription.completed" ? "EXPIRED" : "CANCELLED";
        const cancelNow = new Date();

        let wasSkipped = false;

        await db.transaction().setIsolationLevel("read committed").execute(async (trx) => {
          // Acquire per-tenant advisory lock, prevents race with concurrent re-subscribe
          await sql`SELECT pg_advisory_xact_lock(hashtext('subscription_billing'), hashtext(${cancelTenantId}))`.execute(trx);

          // Re-read THIS subscription inside the lock, a concurrent re-subscribe handler
          // may have already cancelled it while creating a new subscription
          const freshSub = await subscriptionRepository.findByExternalId(externalSubId, trx);
          if (!freshSub || freshSub.status === "CANCELLED" || freshSub.status === "EXPIRED") {
            logger.info(
              `[subscription-billing] Cancel webhook for externalSubId=${externalSubId}, ` +
                `already ${freshSub?.status ?? "not found"}, skipping (likely processed by re-subscribe handler)`
            );
            wasSkipped = true;
            return;
          }

          // Cancel THIS subscription only (not all active subs, a re-subscribe may have created a new one)
          await subscriptionRepository.updateTenantApplicationsBySubscription(
            freshSub.id,
            "CANCELLED",
            trx
          );
          await subscriptionRepository.update(
            freshSub.id,
            {
              status: cancelStatus,
              cancelled_at: freshSub.cancelled_at ?? cancelNow, // Preserve original cancel date from graceful cancel
              cancel_effective_at: cancelNow,
              dunning_started_at: null,
              last_payment_attempt_at: null,
              payment_failure_count: 0,
              grace_period_ends_at: null,
              updated_at: cancelNow,
            },
            trx
          );

          // Check if any OTHER active subscriptions remain (e.g., a re-subscribe created one)
          const remainingActive = await subscriptionRepository.findActiveSubscriptionsByTenant(cancelTenantId, trx);

          if (remainingActive.length === 0) {
            // No other active subs, safe to archive all PLAN entitlements and suspend
            await entitlementsRepository.archiveAllPlanByTenant(cancelTenantId, trx);
            logger.info(
              `[subscription-billing] No remaining active subscriptions for tenant=${cancelTenantId}, archived entitlements`
            );
          } else {
            // Another active sub exists (from re-subscribe), do NOT archive its entitlements
            logger.info(
              `[subscription-billing] ${remainingActive.length} active subscription(s) remain for tenant=${cancelTenantId} after cancelling ${freshSub.id}, ` +
                `preserving entitlements. IDs: ${remainingActive.map((s) => `${s.id}(ext=${s.external_subscription_id},status=${s.status})`).join(", ")}`
            );
          }
        });

        if (wasSkipped) break;

        await this.recordSubscriptionEvent(
          existingSub.id,
          cancelTenantId,
          cancelStatus,
          "WEBHOOK",
          eventId
        );

        // Check outside transaction if tenant should be suspended
        const remainingActive = await subscriptionRepository.findActiveSubscriptionsByTenant(
          cancelTenantId
        );
        if (remainingActive.length === 0) {
          logger.info(
            `[subscription-billing] No remaining active subscriptions for tenant=${cancelTenantId}, suspending tenant`
          );
          await this.updateTenantStatus(cancelTenantId, "SUSPENDED");
          queueSubscriptionNotification({
            type: "SUSPENSION_NOTICE",
            tenantId: cancelTenantId,
            subscriptionId: existingSub.id,
          }).catch((err) =>
            logger.warn(`[subscription-billing] Failed to queue cancellation notification: ${(err as Error).message}`)
          );
        } else {
          logger.info(
            `[subscription-billing] ${remainingActive.length} active subscription(s) remain for tenant=${cancelTenantId}, skipping suspension`
          );
        }
        break;
      }
      default:
        break;
    }
  }

  private async createSubscriptionFromWebhook(
    tenantId: string,
    planVersionId: string,
    externalSubId: string,
    _payload: Record<string, unknown> | undefined,
    authenticatedOnly: boolean,
    notes?: Record<string, string>,
    providerName: BillingProviderName = "RAZORPAY",
    paymentId?: string
  ): Promise<void> {
    // A renewal (see createRenewalCheckout) is a paying customer carrying on,
    // never a trial. When its first charge is deferred to the old expiry date,
    // Razorpay reports it "authenticated" until that date, which the purchase
    // path reads as a trial. Not here: they stay ACTIVE, and their paid-up
    // period runs to exactly the date the first charge is scheduled.
    const isRenewal = notes?.kind === "RENEWAL";
    const isTrialing = authenticatedOnly && !isRenewal;
    const deferredStartMs =
      isRenewal && notes?.start_at ? Number(notes.start_at) * 1000 : 0;
    const isDeferredRenewal = deferredStartMs > Date.now();

    // Pre-transaction: fetch immutable reference data (plans, provider config)
    const planVersion = await plansRepository.getPlanVersionById(planVersionId);
    if (!planVersion) return;

    const provider = await findProviderByName(providerName);
    if (!provider) return;

    const billingCycle = (notes?.billing_cycle as "MONTHLY" | "YEARLY" | "TWO_YEARLY") ?? "MONTHLY";
    const currency = (notes?.currency as "INR" | "USD") ?? "INR";

    const now = new Date();
    const periodEnd = new Date(now);
    if (billingCycle === "TWO_YEARLY") {
      periodEnd.setFullYear(periodEnd.getFullYear() + 2);
    } else if (billingCycle === "YEARLY") {
      periodEnd.setFullYear(periodEnd.getFullYear() + 1);
    } else {
      periodEnd.setMonth(periodEnd.getMonth() + 1);
    }
    if (isDeferredRenewal) periodEnd.setTime(deferredStartMs);

    const basePrice = plansRepository.getPrice(planVersion, billingCycle, currency);
    const price = basePrice > 0 ? Math.round(basePrice * (1 + TAX_RATE) * 100) / 100 : 0;

    // Pre-transaction: cancel old subs at provider level (external API call)
    const existingActivePreTx = await subscriptionRepository.findActiveSubscriptionsByTenant(tenantId);
    for (const oldSub of existingActivePreTx) {
      if (oldSub.external_subscription_id && oldSub.external_subscription_id !== externalSubId) {
        try {
          const oldProviderName = (oldSub.billing_provider_name as BillingProviderName) ?? providerName;
          const oldAdapter = getBillingGatewayAdapter(oldProviderName);
          await oldAdapter.cancelSubscription(oldSub.external_subscription_id);
        } catch {
          // Provider may already have cancelled; continue
        }
      }
    }

    // ── Single locked transaction: ALL reads and writes happen here ──
    const result = await db.transaction().setIsolationLevel("read committed").execute(async (trx) => {
      // Acquire per-tenant advisory lock, serializes all concurrent webhook workers
      // Using 2 arguments (namespace, tenantId) to avoid collisions with other locks
      await sql`SELECT pg_advisory_xact_lock(hashtext('subscription_billing'), hashtext(${tenantId}))`.execute(trx);

      // Re-check: has another worker already handled this subscription?
      const alreadyCreated = await subscriptionRepository.findByExternalId(externalSubId, trx);
      if (alreadyCreated && alreadyCreated.status !== "CANCELLED" && alreadyCreated.status !== "EXPIRED") {
        logger.info(
          `[subscription-billing] createSubscriptionFromWebhook skipped, sub already ACTIVE ` +
            `tenant=${tenantId} externalSubId=${externalSubId} status=${alreadyCreated.status}`
        );
        return null; // Another worker handled it
      }

      const isReactivation = !!alreadyCreated;
      const effectiveSubscriptionId = isReactivation ? alreadyCreated.id : ulid();

      // Re-read active subs inside lock (fresh state)
      const existingActive = await subscriptionRepository.findActiveSubscriptionsByTenant(tenantId, trx);

      // ── Step 1: Archive ALL active PLAN entitlements ──
      // Usage is now tracked independently in tenant_usage_counters,
      // so no carry-over of used_value is needed.
      await entitlementsRepository.archiveAllPlanByTenant(tenantId, trx);

      logger.info(
        `[subscription-billing] createSubscriptionFromWebhook tenant=${tenantId} ` +
          `isReactivation=${isReactivation}, usage tracked via counters, no carry-over needed`
      );

      // ── Step 3: Cancel all existing active subscriptions in DB ──
      for (const oldSub of existingActive) {
        await subscriptionRepository.updateTenantApplicationsBySubscription(oldSub.id, "CANCELLED", trx);
        await subscriptionRepository.update(
          oldSub.id,
          {
            status: "CANCELLED",
            cancelled_at: now,
            cancel_effective_at: now,
            updated_at: now,
          },
          trx
        );
      }

      // ── Step 4: Create or reactivate subscription ──
      if (isReactivation) {
        await subscriptionRepository.update(
          effectiveSubscriptionId,
          {
            plan_version_id: planVersionId,
            plan_code_snapshot: planVersion.plan_code,
            plan_name_snapshot: planVersion.plan_name,
            plan_version_snapshot: planVersion.version,
            billing_cycle: billingCycle,
            currency,
            original_price: price,
            price_snapshot: price,
            billing_provider_id: provider.id,
            external_subscription_id: externalSubId,
            started_at: now,
            current_period_start: now,
            current_period_end: periodEnd,
            status: isTrialing ? "TRIALING" : "ACTIVE",
            billing_provider_name: providerName,
            cancelled_at: null,
            cancel_effective_at: null,
            dunning_started_at: null,
            last_payment_attempt_at: null,
            payment_failure_count: 0,
            grace_period_ends_at: null,
            updated_at: now,
          },
          trx
        );
      } else {
        await subscriptionRepository.create(
          {
            id: effectiveSubscriptionId,
            tenant_id: tenantId,
            plan_version_id: planVersionId,
            plan_code_snapshot: planVersion.plan_code,
            plan_name_snapshot: planVersion.plan_name,
            plan_version_snapshot: planVersion.version,
            billing_cycle: billingCycle,
            currency,
            original_price: price,
            price_snapshot: price,
            billing_provider_id: provider.id,
            external_subscription_id: externalSubId,
            started_at: now,
            current_period_start: now,
            current_period_end: periodEnd,
            status: isTrialing ? "TRIALING" : "ACTIVE",
            billing_provider_name: providerName,
            created_at: now,
            updated_at: now,
          },
          trx
        );
      }

      // ── Step 5: Reconcile tenant applications ──
      const newPlanApps = await subscriptionRepository.getPlanApplications(
        planVersion.plan_id,
        trx
      );

      for (const app of newPlanApps) {
        const existing = await subscriptionRepository.findTenantApplication(
          tenantId,
          app.application_id,
          trx
        );
        if (!existing) {
          try {
            await subscriptionRepository.createTenantApplication(
              {
                id: ulid(),
                tenant_id: tenantId,
                application_id: app.application_id,
                status: isTrialing ? "TRIALING" : "ACTIVE",
                source: "SUBSCRIPTION",
                source_subscription_id: effectiveSubscriptionId,
                created_at: now,
                updated_at: now,
              },
              trx
            );
          } catch (err: unknown) {
            const code = (err as { code?: string })?.code;
            if (code === "23505") {
              const raceExisting = await subscriptionRepository.findTenantApplication(
                tenantId,
                app.application_id,
                trx
              );
              if (raceExisting && raceExisting.status !== "ACTIVE" && raceExisting.status !== "TRIALING") {
                await subscriptionRepository.reactivateTenantApplication(
                  raceExisting.id,
                  {
                    status: isTrialing ? "TRIALING" : "ACTIVE",
                    source: "SUBSCRIPTION",
                    source_subscription_id: effectiveSubscriptionId,
                  },
                  trx
                );
              }
            } else {
              throw err;
            }
          }
        } else if (existing.status !== "ACTIVE" && existing.status !== "TRIALING") {
          await subscriptionRepository.reactivateTenantApplication(
            existing.id,
            {
              status: isTrialing ? "TRIALING" : "ACTIVE",
              source: "SUBSCRIPTION",
              source_subscription_id: effectiveSubscriptionId,
            },
            trx
          );
        }
      }

      // ── Step 6: Create new entitlements (used_value=0, usage lives in counters) ──
      const newProducts = await subscriptionRepository.getPlanVersionProducts(planVersionId, trx);

      for (const pvp of newProducts) {
        await entitlementsRepository.create(
          {
            id: ulid(),
            tenant_id: tenantId,
            product_id: pvp.product_id,
            application_code: pvp.application_code,
            feature_key: pvp.feature_key,
            product_code: pvp.product_code,
            is_unlimited: pvp.is_unlimited,
            limit_value: pvp.limit_value,
            used_value: 0,
            source: "PLAN",
            source_subscription_id: effectiveSubscriptionId,
            source_plan_version_id: planVersionId,
            is_active: true,
            created_at: now,
            updated_at: now,
          },
          trx
        );
      }

      logger.info(
        `[subscription-billing] Created ${newProducts.length} entitlements for tenant=${tenantId} ` +
          `sub=${effectiveSubscriptionId} (usage tracked via counters)`
      );

      return { effectiveSubscriptionId, isReactivation };
    });

    // Skipped by another worker
    if (!result) return;

    // Record audit event and update tenant status (post-transaction)
    await this.recordSubscriptionEvent(
      result.effectiveSubscriptionId,
      tenantId,
      isRenewal ? "RENEWED" : result.isReactivation ? "REACTIVATED" : "CREATED",
      "WEBHOOK",
      null,
      isRenewal
        ? {
            renews_subscription_id: notes?.renews_subscription_id ?? null,
            first_charge_on: isDeferredRenewal ? new Date(deferredStartMs).toISOString() : "now",
            back_due_cycles: Number(notes?.back_due_cycles ?? 0),
            first_charge_total: Number(notes?.first_charge_total ?? price),
          }
        : null
    );

    // Reactivate tenant if it was suspended/cancelled
    await this.updateTenantStatus(tenantId, "ACTIVE");

    // Fire-and-forget: send plan purchase or reactivation notification
    if (isRenewal) {
      // The invoice must match money actually taken, when it is taken:
      //   - immediate: charged just now (this cycle + any overdue cycles);
      //   - deferred WITH overdue cycles: those were charged now as an addon,
      //     the regular cycle comes on the start date;
      //   - deferred, nothing overdue: nothing taken yet, the start-date charge
      //     sends the email + invoice via the subscription.charged safety net,
      //     at price_snapshot (one cycle).
      const backCycles = Number(notes?.back_due_cycles ?? 0);
      const chargedNow = Number(notes?.first_charge_total ?? 0);
      if (!isDeferredRenewal || chargedNow > 0) {
        queueSubscriptionNotification({
          type: "PLAN_PURCHASED",
          tenantId,
          subscriptionId: result.effectiveSubscriptionId,
          metadata: {
            planName: planVersion.plan_name,
            billingCycle,
            currency,
            price: String(isDeferredRenewal ? chargedNow : Number(notes?.first_charge_total ?? price)),
            externalSubscriptionId: externalSubId,
            paymentId,
            backDue:
              backCycles > 0
                ? {
                    cycles: backCycles,
                    total: Number(notes?.back_due_total ?? 0),
                    from: notes?.back_due_from || undefined,
                    to: notes?.back_due_to || undefined,
                  }
                : undefined,
          },
        }).catch((err) =>
          logger.warn(`[subscription-billing] Failed to queue renewal PLAN_PURCHASED notification: ${(err as Error).message}`)
        );
      }
    } else if (result.isReactivation) {
      logger.info(`[subscription-billing] Queueing notification type=REACTIVATION_CONFIRMED tenant=${tenantId} sub=${result.effectiveSubscriptionId} plan=${planVersion.plan_name}`);
      queueSubscriptionNotification({
        type: "REACTIVATION_CONFIRMED",
        tenantId,
        subscriptionId: result.effectiveSubscriptionId,
        metadata: { planName: planVersion.plan_name },
      }).catch((err) =>
        logger.warn(`[subscription-billing] Failed to queue REACTIVATION_CONFIRMED notification: ${(err as Error).message}`)
      );
    } else {
      logger.info(`[subscription-billing] Queueing notification type=PLAN_PURCHASED tenant=${tenantId} sub=${result.effectiveSubscriptionId} plan=${planVersion.plan_name}`);
      queueSubscriptionNotification({
        type: "PLAN_PURCHASED",
        tenantId,
        subscriptionId: result.effectiveSubscriptionId,
        metadata: {
          planName: planVersion.plan_name,
          billingCycle,
          currency,
          price: String(price),
          externalSubscriptionId: externalSubId,
          paymentId,
        },
      }).catch((err) =>
        logger.warn(`[subscription-billing] Failed to queue PLAN_PURCHASED notification: ${(err as Error).message}`)
      );
    }
  }

  /**
   * Activate a FREE plan for a tenant, instant activation without payment.
   * Follows same pattern as createSubscriptionFromWebhook but without external provider.
   *
   * Public entry point used by the plans page "Subscribe" button and the
   * SaaS-self-serve flow. Owns the full lifecycle: pre-flight → cancel
   * external providers → trx body (`_runFreePlanActivationInTrx`) →
   * post-trx hooks (`runFreePlanActivationPostTrx`).
   *
   * For callers that already own a transaction (e.g., onboarding auto-
   * provisioning that creates the tenant in the same trx), use
   * `activateFreePlanWithExistingTrx` instead and run
   * `runFreePlanActivationPostTrx` after committing.
   */
  async activateFreePlan(
    tenantId: string,
    planVersionId: string
  ): Promise<{ subscription_id: string }> {
    const { planVersion, now, periodEnd } =
      await this._validateFreePlanActivation(tenantId, planVersionId);

    // Cancel old subs at provider level (network calls, kept outside trx).
    const existingActivePreTx = await subscriptionRepository.findActiveSubscriptionsByTenant(tenantId);
    for (const oldSub of existingActivePreTx) {
      if (oldSub.external_subscription_id) {
        try {
          const oldProviderName = (oldSub.billing_provider_name as BillingProviderName) ?? "RAZORPAY";
          const oldAdapter = getBillingGatewayAdapter(oldProviderName);
          await oldAdapter.cancelSubscription(oldSub.external_subscription_id);
        } catch {
          // Provider may already have cancelled; continue
        }
      }
    }

    const subscriptionId = ulid();

    await db.transaction().setIsolationLevel("read committed").execute(async (trx) => {
      await this._runFreePlanActivationInTrx(
        { tenantId, planVersionId, planVersion, now, periodEnd, subscriptionId },
        trx
      );
    });

    // Post-transaction hooks (audit, tenant status, welcome email).
    await this.runFreePlanActivationPostTrx({
      subscriptionId,
      tenantId,
      planName: planVersion.plan_name,
    });

    return { subscription_id: subscriptionId };
  }

  /**
   * Activate a FREE plan inside a caller-owned transaction.
   *
   * Used by `tenant-provisioning.service` (and any future caller) that
   * needs the free-plan side effects to commit atomically with their own
   * larger transaction (e.g., tenant + membership + plan + subdomain in
   * one shot).
   *
   * Differences vs `activateFreePlan`:
   *   - Caller provides the trx; this method does NOT open one.
   *   - External-provider cancellation is SKIPPED. Rationale: brand-new
   *     tenants can't have existing external subscriptions to cancel.
   *     If a future caller invokes this for an established tenant with
   *     external subs, they should run that cleanup separately.
   *   - Post-trx hooks are NOT fired here. The caller MUST invoke
   *     `runFreePlanActivationPostTrx` after committing their trx.
   *     that's what makes the resulting rows byte-identical to a
   *     self-serve activation.
   */
  async activateFreePlanWithExistingTrx(
    tenantId: string,
    planVersionId: string,
    trx: Transaction<DB>
  ): Promise<{
    subscription_id: string;
    plan_code: string;
    plan_name: string;
    plan_id: string;
    plan_version: number;
  }> {
    const { planVersion, now, periodEnd } =
      await this._validateFreePlanActivation(tenantId, planVersionId);

    const subscriptionId = ulid();

    await this._runFreePlanActivationInTrx(
      { tenantId, planVersionId, planVersion, now, periodEnd, subscriptionId },
      trx
    );

    return {
      subscription_id: subscriptionId,
      plan_code: planVersion.plan_code,
      plan_name: planVersion.plan_name,
      plan_id: planVersion.plan_id,
      plan_version: planVersion.version,
    };
  }

  /**
   * Pre-flight checks shared by both `activateFreePlan` and
   * `activateFreePlanWithExistingTrx`. Validates the plan version exists,
   * is published, and is FREE; runs the same usage-conflict check the
   * paid checkout flow runs. Returns the loaded plan version + computed
   * timestamps so callers don't redo the work.
   */
  private async _validateFreePlanActivation(
    tenantId: string,
    planVersionId: string
  ): Promise<{
    planVersion: NonNullable<
      Awaited<ReturnType<typeof plansRepository.getPlanVersionById>>
    >;
    now: Date;
    periodEnd: Date;
  }> {
    const planVersion = await plansRepository.getPlanVersionById(planVersionId);
    if (!planVersion) {
      throw new NotFoundError(`Plan version '${planVersionId}' not found`);
    }

    if (!planVersion.is_active || !planVersion.published_at) {
      throw new BadRequestError("This plan version is not available");
    }

    if (planVersion.purchase_mode !== "FREE") {
      throw new BadRequestError("This plan version is not free. Use the checkout flow instead.");
    }

    // Check eligibility (usage vs new limits)
    const eligibility = await this.checkEligibility(tenantId, planVersionId);
    if (!eligibility.can_subscribe && eligibility.conflicts && eligibility.conflicts.length > 0) {
      throw new BadRequestError(
        `Cannot subscribe: current usage exceeds new plan limits. ${JSON.stringify(eligibility.conflicts)}`
      );
    }

    const now = new Date();
    // Free plans get a long period (10 years)
    const periodEnd = new Date(now);
    periodEnd.setFullYear(periodEnd.getFullYear() + SUBSCRIPTION_DURATION_YEARS);

    return { planVersion, now, periodEnd };
  }

  /**
   * In-transaction body of free-plan activation. Pure DB writes, safe to
   * compose inside any caller's transaction.
   *
   * Operations (in order, all inside `trx`):
   *   1. Per-tenant advisory lock to serialise concurrent activations.
   *   2. Archive existing PLAN-sourced entitlements (`is_active=false`).
   *   3. Cancel existing ACTIVE/TRIALING subscriptions and their linked
   *      tenant_applications.
   *   4. Insert the new `subscriptions` row (status=ACTIVE,
   *      billing_cycle=YEARLY, billing_provider_name=FREE, prices=0,
   *      period_end=now+10y).
   *   5. Reconcile `tenant_applications` (insert with race handling, or
   *      reactivate if a suspended row exists).
   *   6. Snapshot `entitlements` from plan_version_products with
   *      `source='PLAN'` + `source_subscription_id` linking back.
   */
  private async _runFreePlanActivationInTrx(
    input: {
      tenantId: string;
      planVersionId: string;
      planVersion: NonNullable<
        Awaited<ReturnType<typeof plansRepository.getPlanVersionById>>
      >;
      now: Date;
      periodEnd: Date;
      subscriptionId: string;
    },
    trx: Transaction<DB>
  ): Promise<void> {
    const { tenantId, planVersionId, planVersion, now, periodEnd, subscriptionId } = input;

    await sql`SELECT pg_advisory_xact_lock(hashtext('subscription_billing'), hashtext(${tenantId}))`.execute(trx);

    // Archive old PLAN entitlements
    await entitlementsRepository.archiveAllPlanByTenant(tenantId, trx);

    // Cancel existing active subscriptions
    const existingActive = await subscriptionRepository.findActiveSubscriptionsByTenant(tenantId, trx);
    for (const oldSub of existingActive) {
      await subscriptionRepository.updateTenantApplicationsBySubscription(oldSub.id, "CANCELLED", trx);
      await subscriptionRepository.update(
        oldSub.id,
        { status: "CANCELLED", cancelled_at: now, cancel_effective_at: now, updated_at: now },
        trx
      );
    }

    // Create subscription (no external provider)
    await subscriptionRepository.create(
      {
        id: subscriptionId,
        tenant_id: tenantId,
        plan_version_id: planVersionId,
        plan_code_snapshot: planVersion.plan_code,
        plan_name_snapshot: planVersion.plan_name,
        plan_version_snapshot: planVersion.version,
        billing_cycle: "YEARLY",
        currency: "INR",
        original_price: 0,
        price_snapshot: 0,
        billing_provider_id: null,
        external_subscription_id: null,
        started_at: now,
        current_period_start: now,
        current_period_end: periodEnd,
        status: "ACTIVE",
        billing_provider_name: "FREE",
        created_at: now,
        updated_at: now,
      },
      trx
    );

    // Reconcile tenant applications
    const newPlanApps = await subscriptionRepository.getPlanApplications(planVersion.plan_id, trx);
    for (const app of newPlanApps) {
      const existing = await subscriptionRepository.findTenantApplication(tenantId, app.application_id, trx);
      if (!existing) {
        try {
          await subscriptionRepository.createTenantApplication(
            {
              id: ulid(),
              tenant_id: tenantId,
              application_id: app.application_id,
              status: "ACTIVE",
              source: "SUBSCRIPTION",
              source_subscription_id: subscriptionId,
              created_at: now,
              updated_at: now,
            },
            trx
          );
        } catch (err: unknown) {
          const code = (err as { code?: string })?.code;
          if (code === "23505") {
            const raceExisting = await subscriptionRepository.findTenantApplication(tenantId, app.application_id, trx);
            if (raceExisting && raceExisting.status !== "ACTIVE") {
              await subscriptionRepository.reactivateTenantApplication(
                raceExisting.id,
                { status: "ACTIVE", source: "SUBSCRIPTION", source_subscription_id: subscriptionId },
                trx
              );
            }
          } else {
            throw err;
          }
        }
      } else if (existing.status !== "ACTIVE") {
        await subscriptionRepository.reactivateTenantApplication(
          existing.id,
          { status: "ACTIVE", source: "SUBSCRIPTION", source_subscription_id: subscriptionId },
          trx
        );
      }
    }

    // Create new entitlements
    const newProducts = await subscriptionRepository.getPlanVersionProducts(planVersionId, trx);
    for (const pvp of newProducts) {
      await entitlementsRepository.create(
        {
          id: ulid(),
          tenant_id: tenantId,
          product_id: pvp.product_id,
          application_code: pvp.application_code,
          feature_key: pvp.feature_key,
          product_code: pvp.product_code,
          is_unlimited: pvp.is_unlimited,
          limit_value: pvp.limit_value,
          used_value: 0,
          source: "PLAN",
          source_subscription_id: subscriptionId,
          source_plan_version_id: planVersionId,
          is_active: true,
          created_at: now,
          updated_at: now,
        },
        trx
      );
    }
  }

  /**
   * Post-transaction hooks for free-plan activation. Records the
   * `subscription_events` audit row, sets `tenants.status='ACTIVE'`, and
   * fire-and-forget queues the FREE_PLAN_ACTIVATED welcome email.
   *
   * Public so callers that ran `activateFreePlanWithExistingTrx` can
   * fire the same hooks after their own trx commits, that's what makes
   * the resulting tenant byte-identical to a self-serve subscriber.
   */
  async runFreePlanActivationPostTrx(input: {
    subscriptionId: string;
    tenantId: string;
    planName: string;
  }): Promise<void> {
    const { subscriptionId, tenantId, planName } = input;

    await this.recordSubscriptionEvent(subscriptionId, tenantId, "CREATED", "API");
    await this.updateTenantStatus(tenantId, "ACTIVE");

    // Fire-and-forget: free plan activation email
    logger.info(
      `[subscription-billing] Queueing notification type=FREE_PLAN_ACTIVATED tenant=${tenantId} sub=${subscriptionId} plan=${planName}`
    );
    queueSubscriptionNotification({
      type: "FREE_PLAN_ACTIVATED",
      tenantId,
      subscriptionId,
      metadata: { planName },
    }).catch((err) =>
      logger.warn(`[subscription-billing] Failed to queue FREE_PLAN_ACTIVATED notification: ${(err as Error).message}`)
    );
  }

  /**
   * Get current subscription for tenant.
   */
  async getCurrentSubscription(tenantId: string) {
    return subscriptionRepository.findCurrentByTenant(tenantId);
  }

  /**
   * Cancel subscription gracefully, marks for cancellation at end of current billing cycle.
   * Subscription stays ACTIVE with `cancelled_at` set until period end.
   * At period end: Razorpay sends `subscription.cancelled` webhook → full teardown.
   * Safety net: hourly BullMQ job catches subscriptions past `cancel_effective_at`.
   */
  async cancelSubscription(tenantId: string, subscriptionId: string): Promise<void> {
    const subscription = await subscriptionRepository.findByIdAndTenant(
      subscriptionId,
      tenantId
    );
    if (!subscription) {
      throw new NotFoundError(`Subscription '${subscriptionId}' not found`);
    }
    if (subscription.status === "CANCELLED" || subscription.status === "EXPIRED") {
      return;
    }
    // Idempotent: if already scheduled for cancellation, return
    if (subscription.cancelled_at) {
      return;
    }

    // Tell billing provider to cancel at end of current billing cycle
    const externalId = subscription.external_subscription_id;
    if (externalId) {
      const providerName = (subscription.billing_provider_name as BillingProviderName) ?? "RAZORPAY";
      const adapter = getBillingGatewayAdapter(providerName);
      try {
        await adapter.cancelSubscription(externalId, true); // cancel_at_cycle_end
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        const desc = (err as { error?: { description?: string } })?.error?.description ?? "";
        const isAlreadyCancelled =
          msg.includes("not cancellable") ||
          msg.includes("cancelled status") ||
          desc.includes("not cancellable") ||
          desc.includes("cancelled status");
        if (!isAlreadyCancelled) throw err;
        // Provider says already cancelled, continue to update our DB
      }
    }

    // Mark subscription as "cancellation scheduled", keep status ACTIVE
    // Entitlements stay active, tenant apps stay active, tenant stays ACTIVE
    const now = new Date();
    await subscriptionRepository.update(
      subscription.id,
      {
        cancelled_at: now,
        cancel_effective_at: subscription.current_period_end,
        updated_at: now,
      }
    );

    await this.recordSubscriptionEvent(
      subscription.id,
      tenantId,
      "CANCEL_SCHEDULED",
      "API"
    );

    // Fire-and-forget: notify tenant owner about scheduled cancellation
    queueSubscriptionNotification({
      type: "CANCELLATION_SCHEDULED",
      tenantId,
      subscriptionId: subscription.id,
      metadata: {
        cancelEffectiveAt: subscription.current_period_end?.toISOString(),
      },
    }).catch((err) =>
      logger.warn(`[subscription-billing] Failed to queue CANCELLATION_SCHEDULED notification: ${(err as Error).message}`)
    );

    logger.info(
      `[subscription-billing] Subscription ${subscription.id} scheduled for cancellation ` +
        `at period end ${subscription.current_period_end.toISOString()} for tenant=${tenantId}`
    );
  }

  /**
   * Reactivate subscription for a suspended/cancelled tenant.
   * Creates a new checkout, tenant becomes ACTIVE when webhook confirms payment.
   */
  async reactivateSubscription(
    tenantId: string,
    params: CreateCheckoutParams
  ): Promise<CreateCheckoutResult> {
    const tenant = await db
      .selectFrom("tenants")
      .select(["id", "status"])
      .where("id", "=", tenantId)
      .executeTakeFirst();

    if (!tenant) {
      throw new NotFoundError("Tenant not found");
    }

    if (tenant.status !== "SUSPENDED" && tenant.status !== "CANCELLED") {
      throw new BadRequestError(
        "Reactivation is only available for suspended or cancelled accounts"
      );
    }

    // createCheckout handles old sub cleanup + new checkout
    const result = await this.createCheckout(tenantId, params);

    return result;
  }

  /**
   * Poll reconciliation: process pending checkouts that webhook may have missed.
   * Fetches each from provider; if active/authenticated, creates subscription and entitlements.
   * Removes expired pending rows (>48h, matches checkout link validity).
   */
  async reconcilePendingSubscriptions(): Promise<{ processed: number; expired: number }> {
    const PENDING_EXPIRY_MS = 48 * 60 * 60 * 1000;
    const expired = await pendingSubscriptionCheckoutRepository.deleteOlderThan(PENDING_EXPIRY_MS);
    const pending = await pendingSubscriptionCheckoutRepository.listAll();
    let processed = 0;

    for (const p of pending) {
      try {
        const providerName = (p.billing_provider_name as BillingProviderName) ?? "RAZORPAY";
        const adapter = getBillingGatewayAdapter(providerName);
        const status = await adapter.fetchSubscription(p.external_subscription_id);
        if (status.status === "active" || status.status === "authenticated") {
          // Razorpay's own notes first: a renewal's markers (kind, start_at,
          // back dues) live only there, and without them a missed renewal
          // webhook would be replayed as a fresh purchase, or a trial.
          const notes: Record<string, string> = {
            ...(status.notes ?? {}),
            tenant_id: p.tenant_id,
            plan_version_id: p.plan_version_id,
            billing_cycle: p.billing_cycle,
            currency: p.currency,
          };
          const isTrialing = status.status === "authenticated";
          const payload: Record<string, unknown> = {
            current_start: status.current_start,
            current_end: status.current_end,
          };
          await this.createSubscriptionFromWebhook(
            p.tenant_id,
            p.plan_version_id,
            p.external_subscription_id,
            payload,
            isTrialing,
            notes,
            providerName
          );
          await pendingSubscriptionCheckoutRepository.deleteByExternalId(p.external_subscription_id);
          processed++;
          logger.info(
            `[subscription-poll] Processed missed webhook: externalSubId=${p.external_subscription_id} tenantId=${p.tenant_id}`
          );
        }
      } catch (err) {
        logger.warn(
          `[subscription-poll] Failed to reconcile externalSubId=${p.external_subscription_id}: ${err instanceof Error ? err.message : String(err)}`
        );
      }
    }

    return { processed, expired };
  }

  /**
   * Process expired grace periods (archive entitlements, cancel apps, suspend tenant).
   */
  async processExpiredGracePeriods(): Promise<number> {
    const subs = await subscriptionRepository.findExpiredGracePeriodSubscriptions();
    for (const sub of subs) {
      await db.transaction().execute(async (trx) => {
        await entitlementsRepository.archiveAllPlanByTenant(sub.tenant_id, trx);
        await subscriptionRepository.updateTenantApplicationsBySubscription(
          sub.id,
          "CANCELLED",
          trx
        );
        await subscriptionRepository.update(
          sub.id,
          {
            status: "CANCELLED",
            cancelled_at: new Date(),
            cancel_effective_at: new Date(),
            dunning_started_at: null,
            last_payment_attempt_at: null,
            payment_failure_count: 0,
            grace_period_ends_at: null,
            updated_at: new Date(),
          },
          trx
        );
      });

      await this.recordSubscriptionEvent(
        sub.id,
        sub.tenant_id,
        "GRACE_EXPIRED",
        "SYSTEM"
      );

      // Suspend the tenant after grace period expires
      await this.updateTenantStatus(sub.tenant_id, "SUSPENDED");

      // Queue suspension notice
      await queueSubscriptionNotification({
        type: "SUSPENSION_NOTICE",
        tenantId: sub.tenant_id,
        subscriptionId: sub.id,
      });
    }
    return subs.length;
  }

  /**
   * Process scheduled cancellations: ACTIVE subscriptions whose cancel_effective_at has passed.
   * Safety net for when billing provider webhooks fail to deliver the cancellation event.
   */
  async processScheduledCancellations(): Promise<number> {
    const subs = await subscriptionRepository.findExpiredScheduledCancellations();
    for (const sub of subs) {
      await db.transaction().execute(async (trx) => {
        await entitlementsRepository.archiveAllPlanByTenant(sub.tenant_id, trx);
        await subscriptionRepository.updateTenantApplicationsBySubscription(
          sub.id,
          "CANCELLED",
          trx
        );
        await subscriptionRepository.update(
          sub.id,
          {
            status: "CANCELLED",
            cancel_effective_at: new Date(),
            updated_at: new Date(),
          },
          trx
        );
      });

      await this.recordSubscriptionEvent(
        sub.id,
        sub.tenant_id,
        "CANCELLED",
        "SYSTEM"
      );

      await this.updateTenantStatus(sub.tenant_id, "SUSPENDED");

      await queueSubscriptionNotification({
        type: "SUSPENSION_NOTICE",
        tenantId: sub.tenant_id,
        subscriptionId: sub.id,
      });

      logger.info(
        `[subscription-billing] Processed scheduled cancellation for subscription=${sub.id} tenant=${sub.tenant_id}`
      );
    }
    return subs.length;
  }

  /**
   * Resolve grace period days from plan version, falling back to default.
   */
  private async resolveGracePeriodDays(planVersionId: string): Promise<number> {
    const planVersion = await plansRepository.getPlanVersionById(planVersionId);
    return planVersion?.grace_period_days ?? GRACE_PERIOD_DAYS;
  }

  /**
   * Record an audit event in the subscription_events table.
   */
  private async recordSubscriptionEvent(
    subscriptionId: string,
    tenantId: string,
    eventType: string,
    eventSource: string,
    providerEventId?: string | null,
    metadata?: Record<string, unknown> | null
  ): Promise<void> {
    try {
      await subscriptionEventsRepository.create({
        id: ulid(),
        subscription_id: subscriptionId,
        tenant_id: tenantId,
        event_type: eventType,
        event_source: eventSource,
        provider_event_id: providerEventId,
        metadata,
      });
    } catch (err) {
      // Audit event failure should never break the main flow
      logger.error(
        `Failed to record subscription event: type=${eventType} sub=${subscriptionId} err=${err instanceof Error ? err.message : String(err)}`
      );
    }
  }

  /**
   * Update tenant status (ACTIVE, SUSPENDED, CANCELLED).
   */
  private async updateTenantStatus(tenantId: string, status: string): Promise<void> {
    try {
      await db
        .updateTable("tenants")
        .set({ status: status as "ACTIVE" | "SUSPENDED" | "CANCELLED" | "PENDING", updated_at: new Date() })
        .where("id", "=", tenantId)
        .execute();
    } catch (err) {
      logger.error(
        `Failed to update tenant status: tenantId=${tenantId} status=${status} err=${err instanceof Error ? err.message : String(err)}`
      );
    }
  }

  async getInvoiceUrl(tenantId: string): Promise<string | null> {
    const sub = await subscriptionRepository.findCurrentByTenant(tenantId);
    if (!sub) return null;
    const s3Key = `invoices/plans/${tenantId}/${sub.id}.pdf`;
    const exists = await invoiceExists(s3Key);
    return exists ? getInvoicePublicUrl(s3Key) : null;
  }
}

export default new SubscriptionBillingService();
