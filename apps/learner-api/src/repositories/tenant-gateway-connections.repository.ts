import { db } from "../db/connection";

export interface ActiveConnectionRow {
  id: string;
  tenant_id: string;
  provider_id: string;
  mode: string;
  credentials_encrypted: unknown;
  billing_provider_name: string;
}

/**
 * Find the active gateway connection for a tenant, with provider name.
 */
export async function findActiveByTenantId(tenantId: string): Promise<ActiveConnectionRow | null> {
  // Only tenant-owned connections take money. Tie-break by most recent
  // connected_at so two accidentally-active rows resolve deterministically.
  const row = await db
    .selectFrom("tenant_gateway_connections as tgc")
    .innerJoin("billing_providers as bp", "bp.id", "tgc.provider_id")
    .select([
      "tgc.id",
      "tgc.tenant_id",
      "tgc.provider_id",
      "tgc.mode",
      "tgc.credentials_encrypted",
      "bp.name as billing_provider_name",
    ])
    .where("tgc.tenant_id", "=", tenantId)
    .where("tgc.is_active", "=", true)
    .where("tgc.mode", "=", "SELF_MANAGED")
    .orderBy("tgc.connected_at", "desc")
    .orderBy("tgc.updated_at", "desc")
    .executeTakeFirst();

  if (!row) return null;

  return {
    id: row.id,
    tenant_id: row.tenant_id,
    provider_id: row.provider_id,
    mode: row.mode,
    credentials_encrypted: row.credentials_encrypted,
    billing_provider_name: row.billing_provider_name,
  };
}

/**
 * Find a specific gateway connection by ID, with provider name.
 * Used by webhook/fulfillment to resolve the exact connection that processed the order.
 */
export async function findById(id: string): Promise<ActiveConnectionRow | null> {
  const row = await db
    .selectFrom("tenant_gateway_connections as tgc")
    .innerJoin("billing_providers as bp", "bp.id", "tgc.provider_id")
    .select([
      "tgc.id",
      "tgc.tenant_id",
      "tgc.provider_id",
      "tgc.mode",
      "tgc.credentials_encrypted",
      "bp.name as billing_provider_name",
    ])
    .where("tgc.id", "=", id)
    .executeTakeFirst();

  if (!row) return null;

  return {
    id: row.id,
    tenant_id: row.tenant_id,
    provider_id: row.provider_id,
    mode: row.mode,
    credentials_encrypted: row.credentials_encrypted,
    billing_provider_name: row.billing_provider_name,
  };
}
