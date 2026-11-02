import { ulid } from "ulid";
import { sql, type Selectable, type Transaction } from "kysely";
import { db } from "../db/connection";
import type { DB, tenant_email_sending_domains } from "../db/types";
import type { DnsRecord } from "../types/email-sending-domain.type";

export type SendingDomainRow = Selectable<tenant_email_sending_domains>;

export interface CreateSendingDomainInput {
  tenantId: string;
  subdomain: string;
  mailFromSubdomain: string;
  sesConfigurationSet: string;
  dnsRecords: DnsRecord[];
}

class EmailSendingDomainRepository {
  async findByTenantAndId(
    tenantId: string,
    id: string,
    trx?: Transaction<DB>,
  ): Promise<SendingDomainRow | null> {
    const row = await (trx || db)
      .selectFrom("tenant_email_sending_domains")
      .selectAll()
      .where("tenant_id", "=", tenantId)
      .where("id", "=", id)
      .executeTakeFirst();
    return row ?? null;
  }

  async findByTenantAndSubdomain(
    tenantId: string,
    subdomain: string,
    trx?: Transaction<DB>,
  ): Promise<SendingDomainRow | null> {
    const row = await (trx || db)
      .selectFrom("tenant_email_sending_domains")
      .selectAll()
      .where("tenant_id", "=", tenantId)
      .where("subdomain", "=", subdomain)
      .executeTakeFirst();
    return row ?? null;
  }

  async listByTenant(tenantId: string): Promise<SendingDomainRow[]> {
    return db
      .selectFrom("tenant_email_sending_domains")
      .selectAll()
      .where("tenant_id", "=", tenantId)
      .orderBy("created_at", "desc")
      .execute();
  }

  /**
   * Return PENDING sending-domain rows that are eligible for a re-check.
   *
   * `minIntervalSeconds` filters out domains we just checked, so a 60s sweep
   * cadence doesn't fire a SES API call against a row we polled 1 second ago.
   * Default 30s leaves headroom for ~2 misses per minute (still ample) while
   * preventing the runaway case where every cycle re-polls every row.
   *
   * NULL `last_checked_at` is treated as "never checked" → always eligible.
   * Ordering by `last_checked_at` (NULLS FIRST) ensures newly-onboarded
   * domains are picked up first, then older rows by least-recently-checked.
   */
  async listPending(
    limit: number,
    minIntervalSeconds = 30,
  ): Promise<SendingDomainRow[]> {
    return db
      .selectFrom("tenant_email_sending_domains")
      .selectAll()
      .where("status", "=", "PENDING")
      .where((eb) =>
        eb.or([
          eb("last_checked_at", "is", null),
          eb(
            "last_checked_at",
            "<",
            new Date(Date.now() - minIntervalSeconds * 1000),
          ),
        ]),
      )
      .orderBy("last_checked_at", sql`asc nulls first`)
      .orderBy("created_at", "asc")
      .limit(limit)
      .execute();
  }

  async create(
    input: CreateSendingDomainInput,
    trx?: Transaction<DB>,
  ): Promise<SendingDomainRow> {
    const id = ulid();
    const now = new Date();
    const row = await (trx || db)
      .insertInto("tenant_email_sending_domains")
      .values({
        id,
        tenant_id: input.tenantId,
        subdomain: input.subdomain,
        mail_from_subdomain: input.mailFromSubdomain,
        ses_configuration_set: input.sesConfigurationSet,
        status: "PENDING",
        dkim_status: null,
        mail_from_status: null,
        dns_records: JSON.stringify(input.dnsRecords),
        failure_reason: null,
        verified_at: null,
        last_checked_at: null,
        created_at: now,
        updated_at: now,
      })
      .returningAll()
      .executeTakeFirstOrThrow();
    return row;
  }

  async deleteById(
    tenantId: string,
    id: string,
    trx?: Transaction<DB>,
  ): Promise<void> {
    await (trx || db)
      .deleteFrom("tenant_email_sending_domains")
      .where("tenant_id", "=", tenantId)
      .where("id", "=", id)
      .execute();
  }

  async updateVerificationState(
    id: string,
    patch: {
      status?: SendingDomainRow["status"];
      dkimStatus?: string | null;
      mailFromStatus?: string | null;
      failureReason?: string | null;
      verifiedAt?: Date | null;
      lastCheckedAt?: Date | null;
    },
    trx?: Transaction<DB>,
  ): Promise<void> {
    const updates: Record<string, unknown> = {
      updated_at: new Date(),
    };
    if (patch.status !== undefined) updates.status = patch.status;
    if (patch.dkimStatus !== undefined) updates.dkim_status = patch.dkimStatus;
    if (patch.mailFromStatus !== undefined) {
      updates.mail_from_status = patch.mailFromStatus;
    }
    if (patch.failureReason !== undefined) {
      updates.failure_reason = patch.failureReason;
    }
    if (patch.verifiedAt !== undefined) updates.verified_at = patch.verifiedAt;
    if (patch.lastCheckedAt !== undefined) {
      updates.last_checked_at = patch.lastCheckedAt;
    }
    await (trx || db)
      .updateTable("tenant_email_sending_domains")
      .set(updates)
      .where("id", "=", id)
      .execute();
  }
}

export default new EmailSendingDomainRepository();
