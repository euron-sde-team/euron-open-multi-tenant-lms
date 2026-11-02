/**
 * App modules (anything importing src/config) must be imported only after startStack()
 * has pointed the gateway bases at the stubs, hence the dynamic import below.
 *
 * Tenant gateway credentials are sealed at rest (AES-256-GCM, `enc:v1:`) and no
 * admin-api response ever carries a secret back.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { createTenant, type Tenant } from "./support/fixtures";
import { connectGateway, gatewayCredentials, type Gateway } from "./support/flows";
import { call, startStack, type Stack } from "./support/stack";

let stack: Stack;

beforeAll(async () => {
  stack = await startStack();
});
afterAll(() => stack?.stop());

const secretsOf = (creds: Record<string, string>) =>
  Object.entries(creds)
    .filter(([k]) => k !== "publishable_key" && k !== "key_id")
    .map(([, v]) => v);

describe.each<Gateway>(["STRIPE", "RAZORPAY"])("sealed %s credentials", (gateway) => {
  let tenant: Tenant;

  beforeAll(async () => {
    tenant = await createTenant(stack.db, `cred-${gateway.toLowerCase()}`);
  });

  it("stores enc:v1: ciphertext and never returns a secret", async () => {
    // Unique secrets per run, so a match in a response cannot be a coincidence.
    const credentials = { ...gatewayCredentials(gateway), webhook_secret: `whsec_unique_${Date.now()}` } as Record<string, string>;
    const { connection, response } = await connectGateway(stack, tenant, gateway, credentials as never);
    expect(connection.credentials_configured).toBe(true);
    expect(connection.is_verified).toBe(true);

    const row = await stack.db
      .selectFrom("tenant_gateway_connections")
      .select("credentials_encrypted")
      .where("id", "=", connection.id)
      .where("tenant_id", "=", tenant.id)
      .executeTakeFirstOrThrow();
    const stored = JSON.stringify(row.credentials_encrypted);
    const cipher = (row.credentials_encrypted as { cipher: string }).cipher;
    expect(cipher.startsWith("enc:v1:")).toBe(true);
    for (const secret of secretsOf(credentials)) expect(stored).not.toContain(secret);
    // ...and it opens back to exactly what was saved, with the configured key.
    const { openSecret } = await import("../../src/utils/crypto");
    expect(JSON.parse(openSecret(cipher))).toEqual(credentials);

    const reads = await Promise.all([
      call(stack.admin, "GET", "/tenant/payment/gateway-connections", { token: tenant.token, tenantId: tenant.id }),
      call(stack.admin, "GET", `/tenant/payment/gateway-connections/${connection.id}`, { token: tenant.token, tenantId: tenant.id }),
      call(stack.admin, "GET", "/tenant/payment/config", { token: tenant.token, tenantId: tenant.id }),
      call(stack.admin, "PATCH", `/tenant/payment/gateway-connections/${connection.id}`, { token: tenant.token, tenantId: tenant.id, body: { label: "renamed" } }),
    ]);
    for (const res of [response, ...reads]) {
      expect(res.status, res.text).toBeLessThan(300);
      for (const secret of secretsOf(credentials)) expect(res.text).not.toContain(secret);
      expect(res.text).not.toContain("enc:v1:");
    }
  });

  it("rejects credentials the gateway does not accept, and stores nothing", async () => {
    const provider = await stack.db.selectFrom("billing_providers").select("id").where("name", "=", gateway).executeTakeFirstOrThrow();
    const bad = gateway === "STRIPE" ? { secret_key: "not-a-key", webhook_secret: "whsec_x" } : { key_id: "not-a-key", key_secret: "x", webhook_secret: "y" };
    const before = await stack.db.selectFrom("tenant_gateway_connections").select("id").where("tenant_id", "=", tenant.id).execute();
    const res = await call(stack.admin, "POST", "/tenant/payment/gateway-connections", {
      token: tenant.token,
      tenantId: tenant.id,
      body: { provider_id: provider.id, mode: "SELF_MANAGED", credentials: bad },
    });
    expect(res.status).toBe(400);
    const after = await stack.db.selectFrom("tenant_gateway_connections").select("id").where("tenant_id", "=", tenant.id).execute();
    expect(after).toHaveLength(before.length);
  });
});
