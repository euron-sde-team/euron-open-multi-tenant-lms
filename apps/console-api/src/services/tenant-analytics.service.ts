import { BadRequestError } from "../errors/bad-request.error";
import { NotFoundError } from "../errors/not-found.error";
import tenantAnalyticsRepository from "../repositories/tenant-analytics.repository";
import tenantOfferingsRepository from "../repositories/tenant-offerings.repository";
import {
  SendTenantEmailInput,
  TenantActivityItem,
  TenantActivityStatus,
  TenantAnalyticsDetail,
  TenantAnalyticsListResponse,
  TenantAnalyticsOverview,
  TenantAnalyticsQuery,
  TenantAnalyticsRow,
  TenantFeatureUsage,
} from "../types/tenant-analytics.type";
import config from "../config";
import emailService from "./email.service";

const DEFAULT_INACTIVE_DAYS = 30;

/** Every tenant is reachable at {slug}.{ROOT_DOMAIN}. */
const platformUrlOf = (slug: string): string =>
  `https://${slug}.${config.ROOT_DOMAIN}`;
const customUrlOf = (customDomain: string | null): string | null =>
  customDomain ? `https://${customDomain}` : null;

const toIso = (d: Date | string | null | undefined): string | null =>
  d ? new Date(d as unknown as string).toISOString() : null;

class TenantAnalyticsService {
  private computeStatus(
    tenantStatus: string,
    lastActivity: Date | null,
    hasActiveSub: boolean,
    cutoff: Date
  ): TenantActivityStatus {
    if (tenantStatus !== "ACTIVE") return "inactive";
    if (hasActiveSub) return "active";
    if (lastActivity && lastActivity >= cutoff) return "active";
    return "dormant";
  }

  private async buildRows(inactiveDays: number): Promise<TenantAnalyticsRow[]> {
    const cutoff = new Date(Date.now() - inactiveDays * 86400000);
    const sinceIso = cutoff.toISOString();

    const [tenants, members, apps, courses, usage, subs] =
      await Promise.all([
        tenantAnalyticsRepository.listTenants(),
        tenantAnalyticsRepository.memberRollup(sinceIso),
        tenantAnalyticsRepository.activeAppRollup(),
        tenantAnalyticsRepository.courseRollup(),
        tenantAnalyticsRepository.usageRecency(),
        tenantAnalyticsRepository.activeSubscriptions(),
      ]);

    const owners = await tenantAnalyticsRepository.ownerContacts(
      tenants.map((t) => t.owner_user_id ?? "").filter(Boolean)
    );

    return tenants.map((t) => {
      const m = members.get(t.id);
      const usageLast = usage.get(t.id) ?? null;
      const memberLast = m?.lastLogin ?? null;
      const lastActivity =
        [memberLast, usageLast]
          .filter((d): d is Date => d instanceof Date)
          .sort((a, b) => b.getTime() - a.getTime())[0] ?? null;
      const sub = subs.get(t.id) ?? null;
      const activityStatus = this.computeStatus(
        t.status,
        lastActivity,
        Boolean(sub),
        cutoff
      );
      const owner = t.owner_user_id ? owners.get(t.owner_user_id) : undefined;
      return {
        id: t.id,
        name: t.name,
        slug: t.slug,
        status: t.status,
        activityStatus,
        createdAt: toIso(t.created_at)!,
        lastActivityAt: toIso(lastActivity),
        memberCount: m?.count ?? 0,
        recentLoginCount: m?.recentLogins ?? 0,
        activeAppCount: apps.get(t.id) ?? 0,
        courseCount: courses.get(t.id) ?? 0,
        plan: sub?.plan ?? null,
        planCode: sub?.planCode ?? null,
        subscriptionStatus: sub?.status ?? null,
        validUntil: sub?.validUntil ?? null,
        customDomain: t.custom_domain ?? null,
        liveUrl: customUrlOf(t.custom_domain ?? null),
        ownerEmail: owner?.email ?? null,
        ownerPhone: owner?.phone ?? null,
        platformUrl: platformUrlOf(t.slug),
        customUrl: customUrlOf(t.custom_domain ?? null),
      };
    });
  }

  private buildOverview(
    rows: TenantAnalyticsRow[],
    inactiveDays: number,
    recentActivity: TenantActivityItem[]
  ): TenantAnalyticsOverview {
    const counts = { active: 0, dormant: 0, inactive: 0 };
    let activeSubscriptions = 0;
    let totalMembers = 0;
    const monthMap = new Map<string, number>();
    for (const r of rows) {
      counts[r.activityStatus]++;
      if (r.subscriptionStatus === "ACTIVE") activeSubscriptions++;
      totalMembers += r.memberCount;
      const month = r.createdAt.slice(0, 7); // YYYY-MM
      monthMap.set(month, (monthMap.get(month) ?? 0) + 1);
    }
    const signupsByMonth = [...monthMap.entries()]
      .sort((a, b) => a[0].localeCompare(b[0]))
      .slice(-12)
      .map(([month, count]) => ({ month, count }));

    return {
      totalTenants: rows.length,
      activeTenants: counts.active,
      dormantTenants: counts.dormant,
      inactiveTenants: counts.inactive,
      activeSubscriptions,
      totalMembers,
      inactiveDays,
      signupsByMonth,
      recentActivity,
    };
  }

  private async recentActivity(): Promise<TenantActivityItem[]> {
    const [tenants, subs] = await Promise.all([
      tenantAnalyticsRepository.recentTenants(12),
      tenantAnalyticsRepository.recentSubscriptions(12),
    ]);
    const items: TenantActivityItem[] = [];
    for (const t of tenants) {
      items.push({
        tenantId: t.id,
        tenantName: t.name,
        type: "tenant_created",
        detail: "New tenant onboarded",
        at: toIso(t.created_at)!,
      });
    }
    for (const s of subs) {
      items.push({
        tenantId: s.tenant_id,
        tenantName: s.tenant_name,
        type: "subscription",
        detail: `Subscription ${String(s.status).toLowerCase()}: ${s.plan_name_snapshot}`,
        at: toIso(s.started_at)!,
      });
    }
    return items
      .sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime())
      .slice(0, 15);
  }

  async listAnalytics(
    query: TenantAnalyticsQuery
  ): Promise<TenantAnalyticsListResponse> {
    const inactiveDays = query.inactiveDays ?? DEFAULT_INACTIVE_DAYS;
    const page = query.page && query.page > 0 ? query.page : 1;
    const limit = Math.min(query.limit ?? 25, 200);

    const allRows = await this.buildRows(inactiveDays);
    const recentActivity = await this.recentActivity();
    const overview = this.buildOverview(allRows, inactiveDays, recentActivity);

    const rows = this.sortRows(this.filterRows(allRows, query), query.sort);

    const total = rows.length;
    const start = (page - 1) * limit;
    const data = rows.slice(start, start + limit);

    return {
      data,
      overview,
      total,
      page,
      limit,
      totalPages: Math.max(1, Math.ceil(total / limit)),
    };
  }

  /** Full (unpaginated) rows for export, with current filters applied. */
  async listAllForExport(query: TenantAnalyticsQuery): Promise<TenantAnalyticsRow[]> {
    const inactiveDays = query.inactiveDays ?? DEFAULT_INACTIVE_DAYS;
    const rows = await this.buildRows(inactiveDays);
    return this.sortRows(this.filterRows(rows, query), query.sort);
  }

  private filterRows(
    rows: TenantAnalyticsRow[],
    query: TenantAnalyticsQuery
  ): TenantAnalyticsRow[] {
    let out = rows;
    if (query.status) out = out.filter((r) => r.activityStatus === query.status);
    if (query.planCode) {
      const pc = query.planCode.toLowerCase();
      out = out.filter(
        (r) =>
          (r.planCode ?? "").toLowerCase().includes(pc) ||
          (r.plan ?? "").toLowerCase().includes(pc)
      );
    }
    if (query.search) {
      const q = query.search.toLowerCase();
      out = out.filter(
        (r) => r.name.toLowerCase().includes(q) || r.slug.toLowerCase().includes(q)
      );
    }
    return out;
  }

  private sortRows(
    rows: TenantAnalyticsRow[],
    sort?: TenantAnalyticsQuery["sort"]
  ): TenantAnalyticsRow[] {
    const by = sort ?? "recent_activity";
    const cmp: Record<string, (a: TenantAnalyticsRow, b: TenantAnalyticsRow) => number> = {
      name: (a, b) => a.name.localeCompare(b.name),
      courses: (a, b) => b.courseCount - a.courseCount,
      members: (a, b) => b.memberCount - a.memberCount,
      created: (a, b) => b.createdAt.localeCompare(a.createdAt),
      recent_activity: (a, b) =>
        (b.lastActivityAt ?? "").localeCompare(a.lastActivityAt ?? ""),
    };
    return [...rows].sort(cmp[by] ?? cmp.recent_activity);
  }

  async getTenantAnalytics(tenantId: string): Promise<TenantAnalyticsDetail> {
    const inactiveDays = DEFAULT_INACTIVE_DAYS;
    const cutoff = new Date(Date.now() - inactiveDays * 86400000);
    const tenant = await tenantAnalyticsRepository.getTenant(tenantId);
    if (!tenant) throw new NotFoundError(`Tenant '${tenantId}' not found`);
    const ownerUserId = tenant.owner_user_id;

    const [
      ownerContact,
      entitlements,
      counters,
      memberStats,
      usageRecency,
      subs,
      offerings,
      offeringCounts,
      activity,
    ] = await Promise.all([
      ownerUserId
        ? tenantAnalyticsRepository.getOwnerContact(ownerUserId)
        : Promise.resolve({ email: null, phone: null }),
      tenantAnalyticsRepository.tenantEntitlements(tenantId),
      tenantAnalyticsRepository.tenantUsageCounters(tenantId),
      tenantAnalyticsRepository.tenantMemberStats(tenantId, cutoff.toISOString()),
      tenantAnalyticsRepository.tenantUsageRecency(tenantId),
      tenantAnalyticsRepository.activeSubscriptions(),
      tenantOfferingsRepository.getSummary(tenantId),
      tenantAnalyticsRepository.offeringCounts(tenantId),
      tenantAnalyticsRepository.tenantActivity(tenantId, 15),
    ]);

    const features: TenantFeatureUsage[] = entitlements.map((e) => {
      const counter = counters.get(e.product_code);
      const currentUsage =
        counter != null ? counter : Number(e.used_value ?? 0);
      return {
        featureKey: e.feature_key,
        productCode: e.product_code,
        applicationCode: e.application_code,
        isUnlimited: Boolean(e.is_unlimited),
        limitValue: Number(e.limit_value ?? 0),
        currentUsage,
        used: currentUsage > 0,
      };
    });

    const sub = subs.get(tenantId) ?? null;
    const lastActivity =
      [memberStats.lastLogin, usageRecency]
        .filter((d): d is Date => d instanceof Date)
        .sort((a, b) => b.getTime() - a.getTime())[0] ?? null;
    const activityStatus = this.computeStatus(
      tenant.status,
      lastActivity,
      Boolean(sub),
      cutoff
    );

    const recentActivity = [
      ...activity.usage.map((u) => ({
        at: toIso(u.created_at)!,
        kind: "product_usage" as const,
        summary: `${u.event_type} ${u.feature_key ?? u.product_code}`,
        product: u.product_code,
        actor: null as string | null,
      })),
      ...activity.usageAdmin.map((u) => ({
        at: toIso(u.created_at)!,
        kind: "admin_usage" as const,
        summary: `${u.event_type}${u.reason ? `: ${u.reason}` : ""}`,
        product: u.product_code,
        actor: u.actor_type ? `${u.actor_type}${u.actor_id ? ` (${u.actor_id})` : ""}` : null,
      })),
      ...activity.appEvents.map((e) => ({
        at: toIso(e.created_at)!,
        kind: "app_status" as const,
        summary: `App ${e.event_type}${e.old_status ? ` (${e.old_status}→${e.new_status})` : ""}`,
        product: null as string | null,
        actor: e.is_system ? "system" : e.admin_user_id ? `admin (${e.admin_user_id})` : null,
      })),
    ]
      .sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime())
      .slice(0, 15);

    return {
      tenant: {
        id: tenant.id,
        name: tenant.name,
        slug: tenant.slug,
        status: tenant.status,
        createdAt: toIso(tenant.created_at)!,
        ownerEmail: ownerContact.email,
        ownerPhone: ownerContact.phone,
        customDomain: tenant.custom_domain ?? null,
        liveUrl: customUrlOf(tenant.custom_domain ?? null),
        platformUrl: platformUrlOf(tenant.slug),
        customUrl: customUrlOf(tenant.custom_domain ?? null),
      },
      activityStatus,
      lastActivityAt: toIso(lastActivity),
      inactiveDays,
      members: { total: memberStats.total, recentLogins: memberStats.recentLogins },
      subscription: sub,
      recentActivity,
      offerings,
      offeringCounts,
      featuresUsed: features.filter((f) => f.used),
      featuresUnused: features.filter((f) => !f.used),
    };
  }

  async sendTenantEmail(
    tenantId: string,
    input: SendTenantEmailInput
  ): Promise<{ to: string; providerMessageId?: string }> {
    if (!input.subject?.trim() || !input.html?.trim()) {
      throw new BadRequestError("subject and html are required");
    }
    const tenant = await tenantAnalyticsRepository.getTenant(tenantId);
    if (!tenant) throw new NotFoundError(`Tenant '${tenantId}' not found`);
    const ownerUserId = tenant.owner_user_id;
    const ownerEmail = ownerUserId
      ? await tenantAnalyticsRepository.getOwnerEmail(ownerUserId)
      : null;
    const to = (input.to?.trim() || ownerEmail || "").trim();
    if (!to) {
      throw new BadRequestError(
        "No recipient: tenant has no owner email and no 'to' was provided"
      );
    }
    const result = await emailService.sendEmail({
      to,
      subject: input.subject.trim(),
      html: input.html,
      senderName: config.PLATFORM_NAME,
    });
    return { to, providerMessageId: result.providerMessageId };
  }
}

export default new TenantAnalyticsService();
