/* eslint-disable @typescript-eslint/no-explicit-any */
import Razorpay from "razorpay";
import { BadRequestError } from "../errors/bad-request.error";
import { ConflictError } from "../errors/conflict-custom.error";
import { NotFoundError } from "../errors/not-found.error";
import tenantGatewayConnectionsRepository from "../repositories/tenant-gateway-connections.repository";
import tenantSubscriptionsRepository from "../repositories/tenant-subscriptions.repository";
import { decryptCredentials } from "../utils/credential-encryption";

interface ResolvedSelfManagedConnection {
  connection_id: string;
  key_id: string;
  key_secret: string;
}

class TenantSubscriptionsService {
  // ─── Gateway Resolution ───────────────────────────────────────────────────

  private async resolveSelfManagedConnection(tenantId: string): Promise<ResolvedSelfManagedConnection> {
    const conn = await tenantGatewayConnectionsRepository.findActiveByTenantId(tenantId);
    if (!conn) {
      throw new BadRequestError("No active payment gateway connection found");
    }
    if (conn.mode !== "SELF_MANAGED") {
      throw new BadRequestError("Subscription plans require a SELF_MANAGED payment gateway");
    }
    if (!conn.is_verified) {
      throw new BadRequestError("Payment gateway connection must be verified to create subscription plans");
    }

    const enc = conn.credentials_encrypted;
    if (!enc || typeof enc !== "object" || !("cipher" in enc) || typeof (enc as { cipher: string }).cipher !== "string") {
      throw new BadRequestError("Gateway connection has no stored credentials");
    }
    const creds = decryptCredentials((enc as { cipher: string }).cipher) as Record<string, string>;

    if (!creds.key_id || !creds.key_secret) {
      throw new BadRequestError("Gateway credentials missing key_id or key_secret");
    }

    return {
      connection_id: conn.id,
      key_id: creds.key_id,
      key_secret: creds.key_secret,
    };
  }

  // ─── Plan CRUD ────────────────────────────────────────────────────────────

  async createPlan(
    tenantId: string,
    data: {
      name: string;
      description?: string;
      billing_cycle: "MONTHLY" | "YEARLY";
      currency: string;
      amount: number;
      trial_days?: number;
      features_summary?: string;
      deactivate_conflicting?: boolean;
    }
  ) {
    if (!data.name?.trim()) throw new BadRequestError("Plan name is required");
    if (!data.currency?.trim()) throw new BadRequestError("Currency is required");
    if (!["INR", "USD"].includes(data.currency.toUpperCase())) {
      throw new BadRequestError("Supported currencies are INR and USD");
    }
    if (data.amount <= 0) throw new BadRequestError("Amount must be greater than 0");
    if (data.trial_days !== undefined && (data.trial_days < 0 || data.trial_days > 365)) {
      throw new BadRequestError("Trial days must be between 0 and 365");
    }

    // Check for existing active plan with same billing_cycle + currency
    const existingPlan = await tenantSubscriptionsRepository.findActiveByBillingCycleAndCurrency(
      tenantId,
      data.billing_cycle,
      data.currency.toUpperCase()
    );
    if (existingPlan) {
      if (!data.deactivate_conflicting) {
        throw new ConflictError(
          `An active ${data.billing_cycle === "MONTHLY" ? "Monthly" : "Yearly"} ${data.currency.toUpperCase()} plan "${existingPlan.name}" already exists. Creating this plan will deactivate the existing one.`
        );
      }
      // Deactivate conflicting plan
      await tenantSubscriptionsRepository.updatePlan(tenantId, existingPlan.id, { is_active: false });
    }

    const resolved = await this.resolveSelfManagedConnection(tenantId);

    // Calculate smallest unit (paise/cents)
    const amountInSmallest = Math.round(data.amount * 100);

    // Create plan on Razorpay
    const rzp = new Razorpay({ key_id: resolved.key_id, key_secret: resolved.key_secret });
    const period = data.billing_cycle === "MONTHLY" ? "monthly" : "yearly";

    const rzpPlan = await (rzp as any).plans.create({
      period,
      interval: 1,
      item: {
        name: data.name,
        description: data.description || undefined,
        amount: amountInSmallest,
        currency: data.currency.toUpperCase(),
      },
    });

    // Store in DB
    return tenantSubscriptionsRepository.createPlan({
      tenant_id: tenantId,
      name: data.name.trim(),
      description: data.description?.trim(),
      billing_cycle: data.billing_cycle,
      currency: data.currency.toUpperCase(),
      amount: data.amount.toFixed(2),
      amount_in_smallest: amountInSmallest,
      gateway_plan_id: rzpPlan.id,
      gateway_provider: "RAZORPAY",
      trial_days: data.trial_days ?? 0,
      features_summary: data.features_summary?.trim(),
    });
  }

  async getPlan(tenantId: string, planId: string) {
    const plan = await tenantSubscriptionsRepository.findPlanById(tenantId, planId);
    if (!plan) throw new NotFoundError("Subscription plan not found");

    const subscriberCount = await tenantSubscriptionsRepository.countSubscribersByPlan(tenantId, planId);
    return { ...plan, subscriber_count: subscriberCount };
  }

  async listPlans(tenantId: string, includeInactive = false) {
    return tenantSubscriptionsRepository.listPlans(tenantId, includeInactive);
  }

  async updatePlan(
    tenantId: string,
    planId: string,
    data: { name?: string; description?: string; is_active?: boolean; features_summary?: string }
  ) {
    const existing = await tenantSubscriptionsRepository.findPlanById(tenantId, planId);
    if (!existing) throw new NotFoundError("Subscription plan not found");

    const updated = await tenantSubscriptionsRepository.updatePlan(tenantId, planId, data);
    if (!updated) throw new NotFoundError("Subscription plan not found");
    return updated;
  }

  async deactivatePlan(tenantId: string, planId: string) {
    const existing = await tenantSubscriptionsRepository.findPlanById(tenantId, planId);
    if (!existing) throw new NotFoundError("Subscription plan not found");

    return tenantSubscriptionsRepository.updatePlan(tenantId, planId, { is_active: false });
  }

  // ─── Settings ─────────────────────────────────────────────────────────────

  async getSettings(tenantId: string) {
    const settings = await tenantSubscriptionsRepository.getSettings(tenantId);
    return settings ?? {
      is_enabled: false,
      grace_period_days: 0,
      reminder_days_before: null,
      dunning_email_interval_hours: 48,
      subscription_name: null,
    };
  }

  async updateSettings(
    tenantId: string,
    data: {
      is_enabled?: boolean;
      grace_period_days?: number;
      reminder_days_before?: number[];
      dunning_email_interval_hours?: number;
      subscription_name?: string | null;
    }
  ) {
    if (data.grace_period_days !== undefined) {
      if (data.grace_period_days < 0 || data.grace_period_days > 30) {
        throw new BadRequestError("Grace period must be between 0 and 30 days");
      }
    }
    if (data.dunning_email_interval_hours !== undefined) {
      if (data.dunning_email_interval_hours < 1 || data.dunning_email_interval_hours > 168) {
        throw new BadRequestError("Dunning email interval must be between 1 and 168 hours");
      }
    }
    if (data.reminder_days_before) {
      if (!Array.isArray(data.reminder_days_before) || data.reminder_days_before.some((d) => d < 1 || d > 30)) {
        throw new BadRequestError("Reminder days must be an array of numbers between 1 and 30");
      }
    }
    if (data.subscription_name !== undefined && data.subscription_name !== null) {
      if (data.subscription_name.length > 100) {
        throw new BadRequestError("Subscription name must be 100 characters or less");
      }
    }

    return tenantSubscriptionsRepository.upsertSettings(tenantId, data);
  }

  // ─── Page Config ────────────────────────────────────────────────────────

  async getPageConfig(tenantId: string) {
    const result = await tenantSubscriptionsRepository.getPageConfig(tenantId);
    return result?.page_config ?? null;
  }

  async updatePageConfig(tenantId: string, sections: unknown) {
    if (!Array.isArray(sections)) {
      throw new BadRequestError("page_config must be an array of section configurations");
    }
    // Sanitize \u0000 from JSON (PostgreSQL rejects null bytes)
    const sanitized = JSON.parse(
      JSON.stringify(sections).replace(/\\u0000/g, "")
    );
    await tenantSubscriptionsRepository.updatePageConfig(tenantId, sanitized);
    return sanitized;
  }

  // ─── Analytics ───────────────────────────────────────────────────────────

  async getAnalytics(tenantId: string) {
    return tenantSubscriptionsRepository.getAnalytics(tenantId);
  }

  // ─── Subscribers ──────────────────────────────────────────────────────────

  async listSubscribers(
    tenantId: string,
    params: { page?: number; limit?: number; status?: string; planId?: string; search?: string }
  ) {
    return tenantSubscriptionsRepository.listSubscribers(tenantId, params);
  }

  async getSubscriber(tenantId: string, subscriptionId: string) {
    const sub = await tenantSubscriptionsRepository.findSubscriberById(tenantId, subscriptionId);
    if (!sub) throw new NotFoundError("Subscription not found");

    const events = await tenantSubscriptionsRepository.listSubscriptionEvents(tenantId, subscriptionId);
    return { ...sub, events };
  }

  async cancelSubscription(tenantId: string, subscriptionId: string) {
    const sub = await tenantSubscriptionsRepository.findSubscriberById(tenantId, subscriptionId);
    if (!sub) throw new NotFoundError("Subscription not found");
    if (!sub.gateway_subscription_id) throw new BadRequestError("Subscription has no gateway subscription ID");

    const resolved = await this.resolveSelfManagedConnection(tenantId);
    const rzp = new Razorpay({ key_id: resolved.key_id, key_secret: resolved.key_secret });

    await (rzp as any).subscriptions.cancel(sub.gateway_subscription_id, false);
    // Status will be updated via webhook
  }

  async pauseSubscription(tenantId: string, subscriptionId: string) {
    const sub = await tenantSubscriptionsRepository.findSubscriberById(tenantId, subscriptionId);
    if (!sub) throw new NotFoundError("Subscription not found");
    if (sub.status !== "ACTIVE") throw new BadRequestError("Only active subscriptions can be paused");
    if (!sub.gateway_subscription_id) throw new BadRequestError("Subscription has no gateway subscription ID");

    const resolved = await this.resolveSelfManagedConnection(tenantId);
    const rzp = new Razorpay({ key_id: resolved.key_id, key_secret: resolved.key_secret });

    await (rzp as any).subscriptions.pause(sub.gateway_subscription_id, { pause_initiated_by: "customer" });
    // Status will be updated via webhook
  }

  async resumeSubscription(tenantId: string, subscriptionId: string) {
    const sub = await tenantSubscriptionsRepository.findSubscriberById(tenantId, subscriptionId);
    if (!sub) throw new NotFoundError("Subscription not found");
    if (sub.status !== "PAUSED") throw new BadRequestError("Only paused subscriptions can be resumed");
    if (!sub.gateway_subscription_id) throw new BadRequestError("Subscription has no gateway subscription ID");

    const resolved = await this.resolveSelfManagedConnection(tenantId);
    const rzp = new Razorpay({ key_id: resolved.key_id, key_secret: resolved.key_secret });

    await (rzp as any).subscriptions.resume(sub.gateway_subscription_id);
    // Status will be updated via webhook
  }
}

export default new TenantSubscriptionsService();
