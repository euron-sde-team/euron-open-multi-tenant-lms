import { sql, type Transaction } from "kysely";

import { db } from "../db/connection";
import type { gateway_connection_status, gateway_mode } from "../db/enums";
import type { DB, tenant_gateway_connections } from "../db/types";

export type GatewayConnectionRow = tenant_gateway_connections;

class TenantGatewayConnectionsRepository {
  async findAllByTenantId(tenantId: string): Promise<GatewayConnectionRow[]> {
    const rows = await db
      .selectFrom("tenant_gateway_connections")
      .selectAll()
      .where("tenant_id", "=", tenantId)
      .orderBy("created_at", "desc")
      .execute();
    return rows as unknown as GatewayConnectionRow[];
  }

  async findActiveByTenantId(tenantId: string): Promise<GatewayConnectionRow | null> {
    const row = await db
      .selectFrom("tenant_gateway_connections")
      .selectAll()
      .where("tenant_id", "=", tenantId)
      .where("is_active", "=", true)
      .executeTakeFirst();
    return row as unknown as GatewayConnectionRow | null;
  }

  /** Active connection joined with its billing provider name (RAZORPAY/STRIPE). */
  async findActiveProviderName(tenantId: string): Promise<string | null> {
    const row = await db
      .selectFrom("tenant_gateway_connections")
      .innerJoin("billing_providers", "billing_providers.id", "tenant_gateway_connections.provider_id")
      .select("billing_providers.name")
      .where("tenant_gateway_connections.tenant_id", "=", tenantId)
      .where("tenant_gateway_connections.is_active", "=", true)
      .executeTakeFirst();
    return row?.name ?? null;
  }

  async findById(id: string, tenantId: string): Promise<GatewayConnectionRow | null> {
    const row = await db
      .selectFrom("tenant_gateway_connections")
      .selectAll()
      .where("id", "=", id)
      .where("tenant_id", "=", tenantId)
      .executeTakeFirst();
    return row as unknown as GatewayConnectionRow | null;
  }

  async create(data: {
    id: string;
    tenant_id: string;
    provider_id: string;
    mode: gateway_mode;
    label: string | null;
    credentials_encrypted: Record<string, unknown> | null;
    platform_commission_pct: string | null;
    platform_commission_flat: string | null;
    is_active: boolean;
    is_verified: boolean;
    connected_at: Date | null;
    status: gateway_connection_status;
    created_at: Date;
    updated_at: Date;
  }, trx?: Transaction<DB>): Promise<GatewayConnectionRow> {
    const row = await (trx || db)
      .insertInto("tenant_gateway_connections")
      .values(data)
      .returningAll()
      .executeTakeFirstOrThrow();
    return row as unknown as GatewayConnectionRow;
  }

  async update(
    id: string,
    tenantId: string,
    data: {
      mode?: string;
      label?: string | null;
      credentials_encrypted?: Record<string, unknown> | null;
      platform_commission_pct?: string | null;
      platform_commission_flat?: string | null;
      is_active?: boolean;
      is_verified?: boolean;
      connected_at?: Date | null;
      status?: gateway_connection_status;
      updated_at: Date;
    },
    trx?: Transaction<DB>
  ): Promise<GatewayConnectionRow | null> {
    const row = await (trx || db)
      .updateTable("tenant_gateway_connections")
      .set(data as Record<string, unknown>)
      .where("id", "=", id)
      .where("tenant_id", "=", tenantId)
      .returningAll()
      .executeTakeFirst();
    return row as unknown as GatewayConnectionRow | null;
  }

  async deactivateAllForTenant(tenantId: string, trx?: Transaction<DB>): Promise<void> {
    await (trx || db)
      .updateTable("tenant_gateway_connections")
      .set({
        is_active: false,
        status: "PENDING" as gateway_connection_status,
        connected_at: null,
        updated_at: new Date(),
      })
      .where("tenant_id", "=", tenantId)
      .where("is_active", "=", true)
      .execute();
  }

  /**
   * Single-statement activation: activates the target connection and deactivates
   * all others for the tenant atomically in one UPDATE.
   */
  async activateExclusive(targetId: string, tenantId: string): Promise<void> {
    await db
      .updateTable("tenant_gateway_connections")
      .set({
        is_active: sql<boolean>`(id = ${targetId})`,
        status: sql<gateway_connection_status>`CASE WHEN id = ${targetId} THEN 'ACTIVE'::gateway_connection_status ELSE 'PENDING'::gateway_connection_status END`,
        connected_at: sql`CASE WHEN id = ${targetId} THEN NOW() ELSE NULL END`,
        updated_at: sql`NOW()`,
      })
      .where("tenant_id", "=", tenantId)
      .where((eb) => eb.or([eb("is_active", "=", true), eb("id", "=", targetId)]))
      .execute();
  }

  async delete(id: string, tenantId: string): Promise<boolean> {
    const result = await db
      .deleteFrom("tenant_gateway_connections")
      .where("id", "=", id)
      .where("tenant_id", "=", tenantId)
      .executeTakeFirst();
    return Number(result.numDeletedRows) > 0;
  }
}

export default new TenantGatewayConnectionsRepository();
