/**
 * What happens when Razorpay confirms a RENEWAL, the step a test-mode
 * checkout could not be driven through headlessly, so it is pinned here.
 *
 * Drives the real processWebhookEvent() with Razorpay-shaped payloads. Only the
 * edges are stubbed: the database, the Razorpay adapter, the notification
 * queue. Everything that decides status, period and invoice is shipping code.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const created: Record<string, unknown>[] = [];
const notifications: Array<{ type: string; metadata?: Record<string, unknown> }> = [];
const cancelledOldSubs: string[] = [];

vi.mock("kysely", async (orig) => ({
  ...((await orig()) as object),
  sql: () => ({ execute: async () => undefined }),
}));

vi.mock("../../src/db/connection", () => {
  const chain: Record<string, unknown> = {};
  for (const m of ["updateTable", "set", "where", "selectFrom", "select"]) chain[m] = () => chain;
  chain.execute = async () => [];
  chain.executeTakeFirst = async () => undefined;
  return {
    db: {
      ...chain,
      transaction: () => ({
        setIsolationLevel: () => ({ execute: (fn: (t: unknown) => unknown) => fn({}) }),
        execute: (fn: (t: unknown) => unknown) => fn({}),
      }),
    },
  };
});

vi.mock("../../src/repositories/subscription.repository", () => ({
  default: {
    findByExternalId: async () => undefined,
    findActiveSubscriptionsByTenant: async () => [
      // The admin-assigned plan being renewed: no Razorpay id behind it.
      { id: "OLD_SUB", external_subscription_id: null, billing_provider_name: null },
    ],
    update: async () => undefined,
    create: async (row: Record<string, unknown>) => {
      created.push(row);
    },
    updateTenantApplicationsBySubscription: async () => undefined,
    getPlanApplications: async () => [],
    getPlanVersionProducts: async () => [],
  },
}));

vi.mock("../../src/repositories/entitlements.repository", () => ({
  default: { archiveAllPlanByTenant: async () => undefined, create: async () => undefined },
}));
vi.mock("../../src/repositories/subscription-events.repository", () => ({
  default: { create: async () => undefined, findBySubscriptionAndType: async () => [] },
}));
vi.mock("../../src/repositories/pending-subscription-checkout.repository", () => ({
  default: { deleteByExternalId: async () => undefined },
}));
vi.mock("../../src/repositories/billing-providers.repository", () => ({
  findProviderByName: async () => ({ id: "PROV_RZP" }),
}));
vi.mock("../../src/services/billing/billing-gateway.factory", () => ({
  getBillingGatewayAdapter: () => ({
    cancelSubscription: async (id: string) => {
      cancelledOldSubs.push(id);
    },
  }),
}));
vi.mock("../../src/queues/subscription-notification.queue", () => ({
  queueSubscriptionNotification: async (job: { type: string; metadata?: Record<string, unknown> }) => {
    notifications.push(job);
  },
}));
vi.mock("../../src/services/tenant-auth.service", () => ({ default: {} }));
vi.mock("../../src/repositories/plans.repository", async (orig) => {
  const real = ((await orig()) as { default: Record<string, unknown> }).default;
  return {
    default: {
      getPrice: real.getPrice.bind(real),
      applyDiscount: real.applyDiscount?.bind(real),
      getPlanVersionById: async () => ({
        id: "PV_STARTER",
        plan_id: "P1",
        plan_code: "starter",
        plan_name: "LMS Starter",
        version: 1,
        price_monthly_inr: 999,
        discount_monthly_inr_type: null,
        discount_monthly_inr_value: 0,
        is_active: false, // retired, renewals must still work
        published_at: new Date("2026-01-01"),
        purchase_mode: "PAID",
      }),
    },
  };
});

const { default: billing } = await import("../../src/services/billing/subscription-billing.service");

/** The webhook Razorpay sends once the customer approves. */
function authenticated(notes: Record<string, string>) {
  return billing.processWebhookEvent("subscription.authenticated", `evt_${Math.random()}`, {
    subscription: { entity: { id: "sub_NEW", status: "authenticated", notes } },
    payment: { entity: { id: "pay_TEST" } },
  });
}

const BASE_NOTES = {
  tenant_id: "T_RENEW",
  plan_version_id: "PV_STARTER",
  billing_cycle: "MONTHLY",
  currency: "INR",
  trial_days: "0",
  kind: "RENEWAL",
  renews_subscription_id: "OLD_SUB",
  cycle_total: "1178.82",
};

beforeEach(() => {
  created.length = 0;
  notifications.length = 0;
  cancelledOldSubs.length = 0;
});

describe("renewal confirmed by Razorpay", () => {
  it("overdue, charged now : ACTIVE, invoice = everything charged, back dues itemised", async () => {
    await authenticated({
      ...BASE_NOTES,
      start_at: "",
      back_due_cycles: "3",
      back_due_total: "3536.46",
      back_due_from: "2026-07-18T18:30:00.000Z",
      back_due_to: "2026-10-18T18:30:00.000Z",
      first_charge_total: "4715.28",
    });

    expect(created).toHaveLength(1);
    expect(created[0]).toMatchObject({ status: "ACTIVE", price_snapshot: 1178.82 });

    const invoice = notifications.find((n) => n.type === "PLAN_PURCHASED");
    expect(invoice?.metadata).toMatchObject({
      price: "4715.28",
      paymentId: "pay_TEST",
      backDue: { cycles: 3, total: 3536.46 },
    });
  });

  it("not expired yet : stays ACTIVE (not a trial) and is paid up to the scheduled charge", async () => {
    // Scheduled charge a few days ahead of "now", so the case never ages out.
    const scheduled = new Date(Math.floor(Date.now() / 1000 + 5 * 86400) * 1000);
    const startAt = Math.floor(scheduled.getTime() / 1000);
    await authenticated({
      ...BASE_NOTES,
      start_at: String(startAt),
      back_due_cycles: "0",
      back_due_total: "0",
      first_charge_total: "0",
    });

    expect(created[0]).toMatchObject({ status: "ACTIVE" });
    expect((created[0].current_period_end as Date).toISOString()).toBe(scheduled.toISOString());
    // Nothing charged yet: the invoice waits for the real scheduled charge.
    expect(notifications.filter((n) => n.type === "PLAN_PURCHASED")).toHaveLength(0);
  });

  it("deferred WITH back dues: invoices only the back dues taken now", async () => {
    const scheduledLater = new Date(Math.floor(Date.now() / 1000 + 12 * 86400) * 1000);
    const startAt = Math.floor(scheduledLater.getTime() / 1000);
    await authenticated({
      ...BASE_NOTES,
      start_at: String(startAt),
      back_due_cycles: "7",
      back_due_total: "8251.74",
      first_charge_total: "8251.74",
    });

    expect(created[0]).toMatchObject({ status: "ACTIVE" });
    expect((created[0].current_period_end as Date).toISOString()).toBe(scheduledLater.toISOString());
    const invoice = notifications.find((n) => n.type === "PLAN_PURCHASED");
    expect(invoice?.metadata).toMatchObject({ price: "8251.74", backDue: { cycles: 7, total: 8251.74 } });
  });

  it("an ordinary purchase is untouched: authenticated-only is still a trial", async () => {
    await billing.processWebhookEvent("subscription.authenticated", "evt_purchase", {
      subscription: {
        entity: {
          id: "sub_NEW",
          status: "authenticated",
          notes: { tenant_id: "T1", plan_version_id: "PV_STARTER", billing_cycle: "MONTHLY", currency: "INR" },
        },
      },
    });
    expect(created[0]).toMatchObject({ status: "TRIALING" });
  });
});
