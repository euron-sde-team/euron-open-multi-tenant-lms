import type { Transaction } from "kysely";
import { db } from "../db/connection";
import type { DB } from "../db/types";
import type { tenant_app_source, tenant_app_status } from "../db/enums";

export interface TenantApplicationRow {
  id: string;
  tenant_id: string;
  application_id: string;
  status: tenant_app_status;
  source: string;
  activated_at: Date | string;
  // Joined from applications table
  application_code: string;
  application_name: string;
  application_description: string | null;
  application_icon_url: string | null;
  application_sort_order: number;
}

export interface TenantApplicationInsert {
  id: string;
  tenant_id: string;
  application_id: string;
  status: tenant_app_status;
  source: tenant_app_source;
  activated_at?: Date;
  trial_ends_at?: Date | null;
  grant_reason?: string | null;
  granted_by?: string | null;
  source_subscription_id?: string | null;
  created_at: Date;
  updated_at: Date;
}

class TenantApplicationRepository {
  /**
   * Find all active (ACTIVE or TRIALING) tenant applications with application details.
   * Joins tenant_applications with applications to get code, name, icon, etc.
   */
  async findActiveByTenantId(
    tenantId: string
  ): Promise<TenantApplicationRow[]> {
    const rows = await db
      .selectFrom("tenant_applications as ta")
      .innerJoin("applications as a", "a.id", "ta.application_id")
      .select([
        "ta.id",
        "ta.tenant_id",
        "ta.application_id",
        "ta.status",
        "ta.source",
        "ta.activated_at",
        "a.code as application_code",
        "a.name as application_name",
        "a.description as application_description",
        "a.icon_url as application_icon_url",
        "a.sort_order as application_sort_order",
      ])
      .where("ta.tenant_id", "=", tenantId)
      .where("ta.status", "in", ["ACTIVE", "TRIALING"])
      .where("a.is_active", "=", true)
      .orderBy("a.sort_order", "asc")
      .orderBy("a.name", "asc")
      .execute();

    return rows as unknown as TenantApplicationRow[];
  }

  /**
   * Insert a tenant_applications row. Used by auto-provisioning to grant
   * a fresh tenant the applications carried by their starter plan.
   */
  async create(
    data: TenantApplicationInsert,
    trx?: Transaction<DB>
  ): Promise<void> {
    const executor = trx || db;
    await executor
      .insertInto("tenant_applications")
      .values({
        id: data.id,
        tenant_id: data.tenant_id,
        application_id: data.application_id,
        status: data.status,
        source: data.source,
        activated_at: data.activated_at ?? data.created_at,
        trial_ends_at: data.trial_ends_at ?? null,
        grant_reason: data.grant_reason ?? null,
        granted_by: data.granted_by ?? null,
        source_subscription_id: data.source_subscription_id ?? null,
        created_at: data.created_at,
        updated_at: data.updated_at,
      })
      .execute();
  }
}

const tenantApplicationRepository = new TenantApplicationRepository();
export default tenantApplicationRepository;
