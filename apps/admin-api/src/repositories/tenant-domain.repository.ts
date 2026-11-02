import type { Transaction } from "kysely";
import { db } from "../db/connection";
import type { DB } from "../db/types";
import { domain_status, domain_type } from "../db/enums";

export interface TenantDomain {
  id: string;
  tenant_id: string;
  domain_type: domain_type;
  domain_name: string;
  subdomain_prefix: string | null;
  hostname_id: string | null;
  status: domain_status;
  ssl_status: string | null;
  ownership_verified: boolean;
  ssl_active: boolean;
  verification_records: unknown;
  error_message: string | null;
  is_primary: boolean;
  created_at: Date;
  updated_at: Date;
  verified_at: Date | null;
}

export interface TenantDomainInsert {
  id: string;
  tenant_id: string;
  domain_type: domain_type;
  domain_name: string;
  subdomain_prefix?: string | null;
  hostname_id?: string | null;
  status?: domain_status;
  ssl_status?: string | null;
  ownership_verified?: boolean;
  ssl_active?: boolean;
  verification_records?: unknown;
  error_message?: string | null;
  is_primary?: boolean;
}

export interface TenantDomainUpdate {
  domain_name?: string;
  status?: domain_status;
  ssl_status?: string | null;
  ownership_verified?: boolean;
  ssl_active?: boolean;
  verification_records?: unknown;
  error_message?: string | null;
  is_primary?: boolean;
  hostname_id?: string | null;
  verified_at?: Date | null;
}

class TenantDomainRepository {
  async findById(id: string): Promise<TenantDomain | undefined> {
    const result = await db
      .selectFrom("tenant_domains")
      .selectAll()
      .where("id", "=", id)
      .executeTakeFirst();

    if (!result) return undefined;
    return this.mapToTenantDomain(result);
  }

  async findByDomainName(domainName: string): Promise<TenantDomain | undefined> {
    const result = await db
      .selectFrom("tenant_domains")
      .selectAll()
      .where("domain_name", "=", domainName)
      .executeTakeFirst();

    if (!result) return undefined;
    return this.mapToTenantDomain(result);
  }

  async findByTenantId(tenantId: string): Promise<TenantDomain[]> {
    const results = await db
      .selectFrom("tenant_domains")
      .selectAll()
      .where("tenant_id", "=", tenantId)
      .orderBy("created_at", "asc")
      .execute();

    return results.map((r) => this.mapToTenantDomain(r));
  }

  async findPrimaryByTenantId(tenantId: string): Promise<TenantDomain | undefined> {
    const result = await db
      .selectFrom("tenant_domains")
      .selectAll()
      .where("tenant_id", "=", tenantId)
      .where("is_primary", "=", true)
      .executeTakeFirst();

    if (!result) return undefined;
    return this.mapToTenantDomain(result);
  }

  async findSubdomainByTenantId(
    tenantId: string,
    trx?: Transaction<DB>
  ): Promise<TenantDomain | undefined> {
    const result = await (trx || db)
      .selectFrom("tenant_domains")
      .selectAll()
      .where("tenant_id", "=", tenantId)
      .where("domain_type", "=", domain_type.SUBDOMAIN)
      .executeTakeFirst();

    if (!result) return undefined;
    return this.mapToTenantDomain(result);
  }

  async findCustomDomainsByTenantId(tenantId: string): Promise<TenantDomain[]> {
    const results = await db
      .selectFrom("tenant_domains")
      .selectAll()
      .where("tenant_id", "=", tenantId)
      .where("domain_type", "=", domain_type.CUSTOM)
      .orderBy("created_at", "asc")
      .execute();

    return results.map((r) => this.mapToTenantDomain(r));
  }

  /**
   * Find all custom domains that are still pending verification or SSL provisioning.
   * Used by the BullMQ polling job to check Cloudflare status.
   */
  async findPendingCustomDomains(): Promise<TenantDomain[]> {
    const results = await db
      .selectFrom("tenant_domains")
      .selectAll()
      .where("domain_type", "=", domain_type.CUSTOM)
      .where((eb) =>
        eb.or([
          eb("status", "=", domain_status.PENDING_VERIFICATION),
          eb("status", "=", domain_status.PENDING_SSL),
        ])
      )
      .execute();

    return results.map((r) => this.mapToTenantDomain(r));
  }

  async domainNameExists(
    domainName: string,
    excludeId?: string,
    trx?: Transaction<DB>
  ): Promise<boolean> {
    let query = (trx || db)
      .selectFrom("tenant_domains")
      .select("id")
      .where("domain_name", "=", domainName);

    if (excludeId) {
      query = query.where("id", "!=", excludeId);
    }

    const result = await query.executeTakeFirst();
    return !!result;
  }

  async create(data: TenantDomainInsert, trx?: Transaction<DB>): Promise<TenantDomain> {
    const result = await (trx || db)
      .insertInto("tenant_domains")
      .values({
        id: data.id,
        tenant_id: data.tenant_id,
        domain_type: data.domain_type,
        domain_name: data.domain_name,
        subdomain_prefix: data.subdomain_prefix ?? null,
        hostname_id: data.hostname_id ?? null,
        status: data.status ?? domain_status.PENDING_VERIFICATION,
        ssl_status: data.ssl_status ?? null,
        ownership_verified: data.ownership_verified ?? false,
        ssl_active: data.ssl_active ?? false,
        verification_records: data.verification_records ?? null,
        error_message: data.error_message ?? null,
        is_primary: data.is_primary ?? false,
        created_at: new Date(),
        updated_at: new Date(),
      })
      .returningAll()
      .executeTakeFirstOrThrow();

    return this.mapToTenantDomain(result);
  }

  async update(id: string, data: TenantDomainUpdate): Promise<TenantDomain | undefined> {
    const updateData: Record<string, unknown> = {
      updated_at: new Date(),
    };

    if (data.domain_name !== undefined) updateData.domain_name = data.domain_name;
    if (data.status !== undefined) updateData.status = data.status;
    if (data.ssl_status !== undefined) updateData.ssl_status = data.ssl_status;
    if (data.ownership_verified !== undefined) updateData.ownership_verified = data.ownership_verified;
    if (data.ssl_active !== undefined) updateData.ssl_active = data.ssl_active;
    if (data.verification_records !== undefined) updateData.verification_records = data.verification_records;
    if (data.error_message !== undefined) updateData.error_message = data.error_message;
    if (data.is_primary !== undefined) updateData.is_primary = data.is_primary;
    if (data.hostname_id !== undefined) updateData.hostname_id = data.hostname_id;
    if (data.verified_at !== undefined) updateData.verified_at = data.verified_at;

    const result = await db
      .updateTable("tenant_domains")
      .set(updateData)
      .where("id", "=", id)
      .returningAll()
      .executeTakeFirst();

    if (!result) return undefined;
    return this.mapToTenantDomain(result);
  }

  async setPrimary(id: string, tenantId: string): Promise<TenantDomain | undefined> {
    await db
      .updateTable("tenant_domains")
      .set({ is_primary: false, updated_at: new Date() })
      .where("tenant_id", "=", tenantId)
      .execute();

    return this.update(id, { is_primary: true });
  }

  async delete(id: string): Promise<boolean> {
    const result = await db
      .deleteFrom("tenant_domains")
      .where("id", "=", id)
      .executeTakeFirst();

    return result.numDeletedRows > 0;
  }

  async deleteByTenantId(tenantId: string): Promise<number> {
    const result = await db
      .deleteFrom("tenant_domains")
      .where("tenant_id", "=", tenantId)
      .executeTakeFirst();

    return Number(result.numDeletedRows);
  }

  private mapToTenantDomain(result: {
    id: string;
    tenant_id: string;
    domain_type: domain_type;
    domain_name: string;
    subdomain_prefix: string | null;
    hostname_id: string | null;
    status: domain_status;
    ssl_status: string | null;
    ownership_verified: boolean;
    ssl_active: boolean;
    verification_records: unknown;
    error_message: string | null;
    is_primary: boolean;
    created_at: Date;
    updated_at: Date;
    verified_at: Date | null;
  }): TenantDomain {
    return {
      id: result.id,
      tenant_id: result.tenant_id,
      domain_type: result.domain_type,
      domain_name: result.domain_name,
      subdomain_prefix: result.subdomain_prefix,
      hostname_id: result.hostname_id,
      status: result.status,
      ssl_status: result.ssl_status,
      ownership_verified: result.ownership_verified,
      ssl_active: result.ssl_active,
      verification_records: result.verification_records,
      error_message: result.error_message,
      is_primary: result.is_primary,
      created_at: new Date(result.created_at),
      updated_at: new Date(result.updated_at),
      verified_at: result.verified_at ? new Date(result.verified_at) : null,
    };
  }
}

export default new TenantDomainRepository();
