#!/usr/bin/env npx ts-node
/**
 * Razorpay Webhook Simulator
 * ==========================
 * Sends webhook events to the local admin-api that are structurally
 * identical to real Razorpay webhooks, same envelope, same HMAC-SHA256 signature,
 * same subscription entity fields.
 *
 * Usage:
 *   npx ts-node scripts/simulate-razorpay-webhook.ts
 *
 * Prerequisites:
 *   1. admin-api running on PORT (default 5086)
 *   2. PLATFORM_RAZORPAY_WEBHOOK_SECRET set in .env
 *   3. An active subscription in the database (run a real checkout first)
 *
 * The script reads the webhook secret from .env so signatures match exactly
 * what the backend expects, no bypassing, no mocking.
 */

import { createHmac, randomUUID } from "node:crypto";
import * as readline from "node:readline";
import * as dotenv from "dotenv";
import * as pg from "pg";

dotenv.config();

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

const BACKEND_PORT = process.env.PORT ?? "5086";
const BACKEND_URL = `http://localhost:${BACKEND_PORT}/api/v1/webhook/razorpay/subscription`;

const WEBHOOK_SECRET = process.env.PLATFORM_RAZORPAY_WEBHOOK_SECRET ?? "";

if (!WEBHOOK_SECRET) {
  console.error(
    "\n❌  PLATFORM_RAZORPAY_WEBHOOK_SECRET not set in .env\n" +
      "    The simulator needs the same secret the backend uses to verify signatures.\n"
  );
  process.exit(1);
}

// ---------------------------------------------------------------------------
// Razorpay-accurate payload builders
// ---------------------------------------------------------------------------

/** Generate a Razorpay-style event ID: evt_<14chars> */
function razorpayEventId(): string {
  return `evt_${randomUUID().replace(/-/g, "").slice(0, 14)}`;
}

const nowSec = () => Math.floor(Date.now() / 1000);

interface SimulationContext {
  externalSubscriptionId: string;
  tenantId: string;
  planVersionId: string;
  billingCycle: string;
  currency: string;
}

/**
 * Build the full Razorpay webhook envelope.
 * Structure verified against official Razorpay docs and real webhook captures.
 */
function buildWebhookPayload(
  event: string,
  ctx: SimulationContext,
  overrides?: Partial<{
    status: string;
    current_start: number;
    current_end: number;
    ended_at: number | null;
    paid_count: number;
    remaining_count: number;
    charge_at: number | null;
    includePayment: boolean;
  }>
) {
  const now = nowSec();

  // Map event → expected subscription status
  const statusMap: Record<string, string> = {
    "subscription.authenticated": "authenticated",
    "subscription.activated": "active",
    "subscription.charged": "active",
    "subscription.halted": "halted",
    "subscription.cancelled": "cancelled",
    "subscription.completed": "completed",
  };

  const status = overrides?.status ?? statusMap[event] ?? "active";

  const subscriptionEntity = {
    id: ctx.externalSubscriptionId,
    entity: "subscription" as const,
    plan_id: `plan_simulated_${ctx.planVersionId.slice(0, 8)}`,
    customer_id: `cust_sim_${ctx.tenantId.slice(0, 8)}`,
    status,
    current_start: overrides?.current_start ?? (status === "authenticated" ? null : now - 30 * 86400),
    current_end: overrides?.current_end ?? (status === "authenticated" ? null : now + 30 * 86400),
    ended_at: overrides?.ended_at ?? (["cancelled", "completed"].includes(status) ? now : null),
    quantity: 1,
    notes: {
      tenant_id: ctx.tenantId,
      plan_version_id: ctx.planVersionId,
      billing_cycle: ctx.billingCycle,
      currency: ctx.currency,
    },
    charge_at:
      overrides?.charge_at !== undefined
        ? overrides.charge_at
        : ["halted", "cancelled", "completed"].includes(status)
          ? null
          : now + 30 * 86400,
    start_at: now - 90 * 86400,
    end_at: now + 365 * 86400,
    auth_attempts: status === "authenticated" ? 1 : 0,
    total_count: 120,
    paid_count: overrides?.paid_count ?? (status === "completed" ? 120 : status === "authenticated" ? 0 : 2),
    customer_notify: true,
    created_at: now - 90 * 86400,
    expire_by: now - 89 * 86400,
    short_url: `https://rzp.io/i/sim_${ctx.externalSubscriptionId.slice(-8)}`,
    has_scheduled_changes: false,
    change_scheduled_at: null,
    source: "api",
    payment_method: "card",
    offer_id: null,
    remaining_count:
      overrides?.remaining_count ?? (status === "completed" ? 0 : 118),
  };

  const payload: Record<string, unknown> = {
    subscription: { entity: subscriptionEntity },
  };

  // subscription.charged includes a payment entity
  if (event === "subscription.charged" || overrides?.includePayment) {
    payload.payment = {
      entity: {
        id: `pay_sim_${randomUUID().replace(/-/g, "").slice(0, 14)}`,
        entity: "payment",
        amount: 49900,
        currency: ctx.currency,
        status: "captured",
        order_id: `order_sim_${randomUUID().replace(/-/g, "").slice(0, 10)}`,
        invoice_id: null,
        international: false,
        method: "card",
        amount_refunded: 0,
        refund_status: null,
        captured: true,
        description: "Subscription charge",
        card_id: null,
        bank: null,
        wallet: null,
        vpa: null,
        email: "simulated@example.com",
        contact: "+919999999999",
        customer_id: subscriptionEntity.customer_id,
        notes: {},
        fee: 998,
        tax: 152,
        error_code: null,
        error_description: null,
        error_source: null,
        error_step: null,
        error_reason: null,
        acquirer_data: { bank_transaction_id: null },
        created_at: now,
      },
    };
  }

  const contains = ["subscription"];
  if (payload.payment) contains.push("payment");

  return {
    entity: "event",
    account_id: "acc_simulated_test",
    event,
    contains,
    payload,
    created_at: now,
    // Razorpay includes a top-level `id` field that our adapter uses as event_id
    id: razorpayEventId(),
  };
}

// ---------------------------------------------------------------------------
// HMAC-SHA256 Signature (identical to Razorpay's signing)
// ---------------------------------------------------------------------------

function signPayload(body: string): string {
  return createHmac("sha256", WEBHOOK_SECRET).update(body).digest("hex");
}

// ---------------------------------------------------------------------------
// HTTP sender
// ---------------------------------------------------------------------------

async function sendWebhook(
  event: string,
  ctx: SimulationContext,
  overrides?: Parameters<typeof buildWebhookPayload>[2]
): Promise<{ status: number; body: unknown }> {
  const payload = buildWebhookPayload(event, ctx, overrides);
  const bodyStr = JSON.stringify(payload);
  const signature = signPayload(bodyStr);

  console.log(`\n📤  Sending ${event}`);
  console.log(`    Subscription: ${ctx.externalSubscriptionId}`);
  console.log(`    Tenant:       ${ctx.tenantId}`);
  console.log(`    Event ID:     ${payload.id}`);
  console.log(`    Signature:    ${signature.slice(0, 16)}...`);

  const res = await fetch(BACKEND_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-razorpay-signature": signature,
      "x-razorpay-event-id": payload.id,
    },
    body: bodyStr,
  });

  const responseBody = await res.json().catch(() => res.text());
  return { status: res.status, body: responseBody };
}

function printResult(result: { status: number; body: unknown }) {
  const body = result.body as Record<string, unknown> | undefined;
  const processingStatus = body?.status as string | undefined;
  const processingError = body?.error as string | undefined;

  if (result.status >= 200 && result.status < 300 && processingStatus === "COMPLETED") {
    console.log(`✅  Response: ${result.status}, processed successfully`);
  } else if (result.status >= 200 && result.status < 300 && processingStatus === "FAILED") {
    console.log(`⚠️   Response: ${result.status}, received but PROCESSING FAILED: ${processingError}`);
  } else if (result.status >= 200 && result.status < 300) {
    console.log(`✅  Response: ${result.status} ${JSON.stringify(result.body)}`);
  } else {
    console.log(`❌  Response: ${result.status} ${JSON.stringify(result.body)}`);
  }
}

// ---------------------------------------------------------------------------
// Interactive menu
// ---------------------------------------------------------------------------

const EVENTS = [
  {
    key: "1",
    event: "subscription.authenticated",
    label: "Authenticated (trial start / mandate authorized)",
    description:
      "Simulates a customer completing checkout authorization.\n" +
      "    Effect: Creates subscription + entitlements, sets tenant ACTIVE.",
  },
  {
    key: "2",
    event: "subscription.activated",
    label: "Activated (first billing cycle starts)",
    description:
      "Simulates subscription moving from authenticated → active.\n" +
      "    Effect: Updates subscription status to ACTIVE.",
  },
  {
    key: "3",
    event: "subscription.charged",
    label: "Charged (recurring payment success)",
    description:
      "Simulates a successful recurring payment.\n" +
      "    Effect: Updates period dates, clears dunning, reactivates if PAST_DUE.",
  },
  {
    key: "4",
    event: "subscription.halted",
    label: "Halted (payment retries exhausted → dunning)",
    description:
      "Simulates all payment retries failing.\n" +
      "    Effect: Sets PAST_DUE, starts grace period + dunning, queues notification.",
  },
  {
    key: "5",
    event: "subscription.cancelled",
    label: "Cancelled (subscription terminated)",
    description:
      "Simulates subscription cancellation (by API, dashboard, or Razorpay).\n" +
      "    Effect: Archives entitlements, cancels apps, SUSPENDS tenant, clears dunning.",
  },
  {
    key: "6",
    event: "subscription.completed",
    label: "Completed (all billing cycles done)",
    description:
      "Simulates subscription reaching end of term (paid_count == total_count).\n" +
      "    Effect: Same as cancelled, archives entitlements, SUSPENDS tenant.",
  },
  {
    key: "7",
    event: "LIFECYCLE",
    label: "Full lifecycle (authenticated → charged → halted → cancelled)",
    description:
      "Runs the complete lifecycle sequence with pauses between events.\n" +
      "    Lets you inspect DB state at each step.",
  },
  {
    key: "8",
    event: "RECOVERY",
    label: "Recovery flow (halted → charged → recovered)",
    description:
      "Simulates dunning followed by successful payment recovery.\n" +
      "    Effect: halted → PAST_DUE, then charged → clears dunning, reactivates tenant.",
  },
] as const;

function printMenu() {
  console.log("\n╔══════════════════════════════════════════════════════════╗");
  console.log("║         Razorpay Webhook Simulator                     ║");
  console.log("╚══════════════════════════════════════════════════════════╝\n");
  console.log("Events:\n");
  for (const e of EVENTS) {
    console.log(`  [${e.key}] ${e.label}`);
    console.log(`      ${e.description.split("\n")[0]}`);
    if (e.description.split("\n").length > 1) {
      console.log(`      ${e.description.split("\n")[1]}`);
    }
    console.log();
  }
  console.log("  [q] Quit\n");
}

async function prompt(rl: readline.Interface, question: string): Promise<string> {
  return new Promise((resolve) => {
    rl.question(question, (answer) => resolve(answer.trim()));
  });
}

async function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

async function getContext(rl: readline.Interface): Promise<SimulationContext> {
  console.log("\n── Subscription Context ──\n");
  console.log("  You need an existing Razorpay external subscription ID");
  console.log("  (the sub_xxx from your subscriptions table), or enter a");
  console.log("  fake one to test the 'new subscription via webhook' path.\n");

  const externalSubscriptionId = await prompt(
    rl,
    "  External Subscription ID (e.g. sub_xxx): "
  );
  if (!externalSubscriptionId) {
    console.log("  ❌ Required. Aborting.");
    process.exit(1);
  }

  const tenantId = await prompt(rl, "  Tenant ID (ULID from tenants table): ");
  if (!tenantId) {
    console.log("  ❌ Required. Aborting.");
    process.exit(1);
  }

  const planVersionId = await prompt(
    rl,
    "  Plan Version ID (ULID from plan_versions table): "
  );
  if (!planVersionId) {
    console.log("  ❌ Required. Aborting.");
    process.exit(1);
  }

  const billingCycle =
    (await prompt(rl, "  Billing Cycle [MONTHLY/YEARLY] (default: MONTHLY): ")) ||
    "MONTHLY";
  const currency =
    (await prompt(rl, "  Currency [INR/USD] (default: INR): ")) || "INR";

  return {
    externalSubscriptionId,
    tenantId,
    planVersionId,
    billingCycle,
    currency,
  };
}

/**
 * Query the database directly to show current tenant & subscription state.
 * Uses PG_* env vars (same as the backend).
 */
async function checkDatabaseState(ctx: SimulationContext): Promise<void> {
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) {
    console.log("\n    (Skipping DB check: DATABASE_URL not set)");
    return;
  }

  // Strip ?schema= parameter that's incompatible with pg
  const cleanUrl = dbUrl.replace(/\?schema=[^&]*/, "");
  const client = new pg.Client({ connectionString: cleanUrl });

  try {
    await client.connect();

    // Check tenant status
    const tenantResult = await client.query(
      `SELECT id, name, slug, status, updated_at FROM tenants WHERE id = $1`,
      [ctx.tenantId]
    );

    // Check all subscriptions for this tenant
    const subsResult = await client.query(
      `SELECT id, external_subscription_id, status, billing_cycle, created_at, updated_at
       FROM subscriptions WHERE tenant_id = $1 ORDER BY created_at DESC`,
      [ctx.tenantId]
    );

    // Check billing_webhooks for this subscription
    const webhooksResult = await client.query(
      `SELECT event_type, event_id, status, error_message, created_at
       FROM billing_webhooks WHERE payload::text LIKE $1 ORDER BY created_at DESC LIMIT 8`,
      [`%${ctx.externalSubscriptionId}%`]
    );

    console.log("\n\n╔══════════════════════════════════════════════════════════╗");
    console.log("║         Database State Check                           ║");
    console.log("╚══════════════════════════════════════════════════════════╝");

    if (tenantResult.rows.length > 0) {
      const t = tenantResult.rows[0];
      const statusIcon = t.status === "SUSPENDED" ? "🔴" : t.status === "ACTIVE" ? "🟢" : "🟡";
      console.log(`\n  Tenant: ${t.name} (${t.slug})`);
      console.log(`  Status: ${statusIcon} ${t.status}  (updated: ${new Date(t.updated_at).toISOString()})`);
    } else {
      console.log(`\n  ⚠️  Tenant not found: ${ctx.tenantId}`);
    }

    console.log(`\n  Subscriptions for this tenant (${subsResult.rows.length} total):`);
    for (const s of subsResult.rows) {
      const isTarget = s.external_subscription_id === ctx.externalSubscriptionId;
      const marker = isTarget ? " ← target" : "";
      console.log(
        `    ${s.status.padEnd(10)} ext=${s.external_subscription_id ?? "null"}  id=${s.id.slice(0, 12)}...${marker}`
      );
    }

    console.log(`\n  Recent billing_webhooks for this subscription:`);
    if (webhooksResult.rows.length === 0) {
      console.log("    (none found)");
    }
    for (const w of webhooksResult.rows) {
      const icon = w.status === "COMPLETED" ? "✅" : w.status === "FAILED" ? "❌" : "⏳";
      const errMsg = w.error_message ? `, ${w.error_message}` : "";
      console.log(`    ${icon} ${w.event_type.padEnd(28)} ${w.status}${errMsg}`);
    }

    console.log();
  } catch (err) {
    console.log(`\n    ⚠️  DB check failed: ${err instanceof Error ? err.message : String(err)}`);
  } finally {
    await client.end().catch(() => {});
  }
}

async function runLifecycle(ctx: SimulationContext) {
  console.log("\n🔄  Running full lifecycle sequence...\n");

  const steps: Array<{
    event: string;
    label: string;
    overrides?: Parameters<typeof buildWebhookPayload>[2];
  }> = [
    {
      event: "subscription.authenticated",
      label: "Step 1/4: Authenticated (creates subscription + entitlements)",
    },
    {
      event: "subscription.charged",
      label: "Step 2/4: Charged (first successful payment)",
      overrides: { paid_count: 1, remaining_count: 119 },
    },
    {
      event: "subscription.halted",
      label: "Step 3/4: Halted (payment failed → dunning + grace period)",
    },
    {
      event: "subscription.cancelled",
      label: "Step 4/4: Cancelled (subscription terminated → tenant suspended)",
    },
  ];

  for (const step of steps) {
    console.log(`\n━━━ ${step.label} ━━━`);
    const result = await sendWebhook(step.event, ctx, step.overrides);
    printResult(result);
    console.log("\n    ⏳ Check the database now. Continuing in 3 seconds...");
    await sleep(3000);
  }

  console.log("\n🏁  Lifecycle complete.");
  await checkDatabaseState(ctx);
}

async function runRecovery(ctx: SimulationContext) {
  console.log("\n🔄  Running recovery flow...\n");

  const steps: Array<{
    event: string;
    label: string;
    overrides?: Parameters<typeof buildWebhookPayload>[2];
  }> = [
    {
      event: "subscription.halted",
      label: "Step 1/2: Halted (payment fails → PAST_DUE + dunning starts)",
    },
    {
      event: "subscription.charged",
      label: "Step 2/2: Charged (payment recovered → clears dunning, reactivates)",
      overrides: { paid_count: 3, remaining_count: 117 },
    },
  ];

  for (const step of steps) {
    console.log(`\n━━━ ${step.label} ━━━`);
    const result = await sendWebhook(step.event, ctx, step.overrides);
    printResult(result);
    console.log("\n    ⏳ Check the database now. Continuing in 3 seconds...");
    await sleep(3000);
  }

  console.log("\n🏁  Recovery complete.");
  await checkDatabaseState(ctx);
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  console.log(`\n🔗  Target: ${BACKEND_URL}`);
  console.log(`🔑  Webhook secret: ${WEBHOOK_SECRET.slice(0, 4)}${"*".repeat(WEBHOOK_SECRET.length - 4)}`);

  let ctx: SimulationContext | null = null;

   
  while (true) {
    printMenu();
    const choice = await prompt(rl, "Select event [1-8, q]: ");

    if (choice === "q" || choice === "Q") {
      console.log("\nBye! 👋\n");
      rl.close();
      process.exit(0);
    }

    const selected = EVENTS.find((e) => e.key === choice);
    if (!selected) {
      console.log("  Invalid choice. Try again.");
      continue;
    }

    // Get or reuse context
    if (!ctx) {
      ctx = await getContext(rl);
    } else {
      const reuse = await prompt(
        rl,
        `\n  Reuse previous context? (sub=${ctx.externalSubscriptionId}, tenant=${ctx.tenantId}) [Y/n]: `
      );
      if (reuse.toLowerCase() === "n") {
        ctx = await getContext(rl);
      }
    }

    if (selected.event === "LIFECYCLE") {
      await runLifecycle(ctx);
    } else if (selected.event === "RECOVERY") {
      await runRecovery(ctx);
    } else {
      const result = await sendWebhook(selected.event, ctx);
      printResult(result);
    }

    console.log("\n────────────────────────────────────────────────────────");
  }
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
