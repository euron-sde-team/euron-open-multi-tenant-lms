import { ulid } from "ulid";
import { BadRequestError } from "../errors/bad-request.error";
import { ConflictError } from "../errors/conflict-custom.error";
import { NotFoundError } from "../errors/not-found.error";
import billingProviderRepository from "../repositories/billing-provider.repository";
import {
  BillingProviderAnalyticsResponse,
  BillingProviderListResponse,
  BillingProviderQueryParams,
  BillingProviderResponse,
  CreateBillingProviderRequest,
  UpdateBillingProviderRequest,
} from "../types/billing-provider.type";
import { AuditActor } from "../types/audit-log.type";
import auditService from "./audit.service";

class BillingProviderService {
  async listProviders(params: BillingProviderQueryParams): Promise<BillingProviderListResponse> {
    const limit = Math.min(params.limit ?? 50, 100);
    const page = Math.max(params.page ?? 1, 1);
    const offset = (page - 1) * limit;

    const { rows, total } = await billingProviderRepository.findAll({
      is_active: params.is_active,
      limit,
      offset,
    });

    return { data: rows, total };
  }

  async getProviderById(id: string): Promise<BillingProviderResponse> {
    const provider = await billingProviderRepository.findById(id);
    if (!provider) {
      throw new NotFoundError("Billing provider not found");
    }
    return provider;
  }

  async createProvider(
    data: CreateBillingProviderRequest,
    actor: AuditActor
  ): Promise<BillingProviderResponse> {
    const name = data.name?.trim().toUpperCase();
    if (!name) {
      throw new BadRequestError("Provider name is required");
    }

    const existing = await billingProviderRepository.findByName(name);
    if (existing) {
      throw new ConflictError("A billing provider with this name already exists");
    }

    const now = new Date();
    const created = await billingProviderRepository.create({
      id: ulid(),
      name,
      credential_schema: data.credential_schema ?? undefined,
      is_active: data.is_active ?? true,
      is_visible_to_tenant: data.is_visible_to_tenant ?? true,
      created_at: now,
      updated_at: now,
    });

    await auditService.record({
      actor,
      action: "BILLING_PROVIDER_CREATED",
      category: "BILLING_PROVIDER",
      resourceId: created.id,
      resourceLabel: created.name,
      summary: `Created billing provider ${created.name}`,
    });

    return created;
  }

  async updateProvider(
    id: string,
    data: UpdateBillingProviderRequest,
    actor: AuditActor
  ): Promise<BillingProviderResponse> {
    const existing = await billingProviderRepository.findById(id);
    if (!existing) {
      throw new NotFoundError("Billing provider not found");
    }

    if (data.name !== undefined) {
      const name = data.name.trim().toUpperCase();
      if (!name) {
        throw new BadRequestError("Provider name cannot be empty");
      }
      if (name !== existing.name) {
        const byName = await billingProviderRepository.findByName(name);
        if (byName) {
          throw new ConflictError("A billing provider with this name already exists");
        }
      }
    }

    const updated = await billingProviderRepository.update(id, {
      name: data.name !== undefined ? data.name.trim().toUpperCase() : undefined,
      credential_schema: data.credential_schema !== undefined ? data.credential_schema : undefined,
      is_active: data.is_active,
      is_visible_to_tenant: data.is_visible_to_tenant,
      updated_at: new Date(),
    });

    if (!updated) {
      throw new NotFoundError("Billing provider not found");
    }

    await auditService.record({
      actor,
      action: "BILLING_PROVIDER_UPDATED",
      category: "BILLING_PROVIDER",
      resourceId: updated.id,
      resourceLabel: updated.name,
      summary: `Updated billing provider ${updated.name}`,
    });

    return updated;
  }

  async deleteProvider(id: string, actor: AuditActor): Promise<void> {
    const existing = await billingProviderRepository.findById(id);
    if (!existing) {
      throw new NotFoundError("Billing provider not found");
    }

    const [subs, addonSubs, webhooks] = await Promise.all([
      billingProviderRepository.countSubscriptionsByProvider(id),
      billingProviderRepository.countAddonSubscriptionsByProvider(id),
      billingProviderRepository.countWebhooksByProvider(id),
    ]);

    if (subs > 0 || addonSubs > 0 || webhooks > 0) {
      throw new ConflictError(
        "Provider is in use by subscriptions, add-on subscriptions, or webhooks and cannot be deleted"
      );
    }

    const deleted = await billingProviderRepository.delete(id);
    if (!deleted) {
      throw new NotFoundError("Billing provider not found");
    }

    await auditService.record({
      actor,
      action: "BILLING_PROVIDER_DELETED",
      category: "BILLING_PROVIDER",
      resourceId: id,
      resourceLabel: existing.name,
      summary: `Deleted billing provider ${existing.name}`,
    });
  }

  async getAnalytics(): Promise<BillingProviderAnalyticsResponse> {
    const now = new Date();
    const startOfMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1, 0, 0, 0, 0));

    const [
      allProviders,
      activeCount,
      webhooksThisMonthByProvider,
      webhooksThisMonthTotal,
      platformEarningThisMonth,
      platformEarningTotal,
      subscriptionCountByProvider,
      successRateGlobal,
    ] = await Promise.all([
      billingProviderRepository.findAll({ limit: 500, offset: 0 }),
      billingProviderRepository.countActiveProviders(),
      billingProviderRepository.countWebhooksThisMonthByProvider(),
      billingProviderRepository.countWebhooksByProvider(null, startOfMonth),
      billingProviderRepository.platformEarningByProvider(startOfMonth),
      billingProviderRepository.platformEarningByProvider(),
      billingProviderRepository.subscriptionCountByProvider(),
      billingProviderRepository.webhookSuccessRate(null, startOfMonth),
    ]);

    const webhookCountMap = new Map<string, number>();
    for (const row of webhooksThisMonthByProvider) {
      webhookCountMap.set(row.billing_provider_id, Number(row.count));
    }

    const platformThisMonthMap = new Map<string, number>();
    for (const row of platformEarningThisMonth) {
      const key = row.billing_provider_id ?? "__null__";
      platformThisMonthMap.set(key, Number(row.total));
    }

    const platformTotalMap = new Map<string, number>();
    for (const row of platformEarningTotal) {
      const key = row.billing_provider_id ?? "__null__";
      platformTotalMap.set(key, Number(row.total));
    }

    const subscriptionCountMap = new Map<string, number>();
    for (const row of subscriptionCountByProvider) {
      const key = row.billing_provider_id ?? "__null__";
      subscriptionCountMap.set(key, Number(row.count));
    }

    const platformEarningThisMonthTotal = Array.from(platformThisMonthMap.values()).reduce((a, b) => a + b, 0);

    const providers = allProviders.rows.map((p) => {
      const subCount = subscriptionCountMap.get(p.id) ?? 0;
      const platformTotal = platformTotalMap.get(p.id) ?? 0;
      const platformThisMonth = platformThisMonthMap.get(p.id) ?? 0;
      const webhooksThisMonth = webhookCountMap.get(p.id) ?? 0;
      return {
        provider_id: p.id,
        provider_name: p.name,
        subscription_count: subCount,
        platform_earning_total: platformTotal,
        platform_earning_this_month: platformThisMonth,
        tenant_earning_total: 0,
        tenant_earning_this_month: 0,
        webhooks_this_month: webhooksThisMonth,
        success_rate: null as number | null,
      };
    });

    // Resolve success_rate per provider (we already have the method, call it per provider)
    const providerIds = providers.map((x) => x.provider_id);
    const successRates = await Promise.all(
      providerIds.map((pid) => billingProviderRepository.webhookSuccessRate(pid, startOfMonth))
    );
    providers.forEach((p, i) => {
      p.success_rate = successRates[i] ?? null;
    });

    const overview = {
      total_providers: allProviders.total,
      active_providers: activeCount,
      webhooks_this_month: webhooksThisMonthTotal,
      platform_earning_this_month: platformEarningThisMonthTotal,
      tenant_earning_this_month: 0,
      success_rate: successRateGlobal,
    };

    return { overview, providers };
  }
}

export default new BillingProviderService();
