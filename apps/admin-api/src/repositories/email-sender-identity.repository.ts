import { ulid } from "ulid";
import type { Selectable, Transaction } from "kysely";
import { db } from "../db/connection";
import type { DB, tenant_email_sender_identities } from "../db/types";

export type SenderIdentityRow = Selectable<tenant_email_sender_identities>;

export interface CreateSenderIdentityRow {
  tenantId: string;
  sendingDomainId: string;
  emailAddress: string;
  displayName: string | null;
  replyTo: string | null;
  isDefaultTransactional: boolean;
  isDefaultNotification: boolean;
  isDefaultMarketing: boolean;
}

export interface UpdateSenderIdentityRow {
  displayName?: string | null;
  replyTo?: string | null;
  status?: SenderIdentityRow["status"];
  isDefaultTransactional?: boolean;
  isDefaultNotification?: boolean;
  isDefaultMarketing?: boolean;
}

type DefaultCategoryColumn =
  | "is_default_transactional"
  | "is_default_notification"
  | "is_default_marketing";

class EmailSenderIdentityRepository {
  async findByTenantAndId(
    tenantId: string,
    id: string,
    trx?: Transaction<DB>,
  ): Promise<SenderIdentityRow | null> {
    const row = await (trx || db)
      .selectFrom("tenant_email_sender_identities")
      .selectAll()
      .where("tenant_id", "=", tenantId)
      .where("id", "=", id)
      .executeTakeFirst();
    return row ?? null;
  }

  async findByTenantAndEmail(
    tenantId: string,
    emailAddress: string,
    trx?: Transaction<DB>,
  ): Promise<SenderIdentityRow | null> {
    const row = await (trx || db)
      .selectFrom("tenant_email_sender_identities")
      .selectAll()
      .where("tenant_id", "=", tenantId)
      .where("email_address", "=", emailAddress)
      .executeTakeFirst();
    return row ?? null;
  }

  async findDefaultForCategory(
    tenantId: string,
    column: DefaultCategoryColumn,
    trx?: Transaction<DB>,
  ): Promise<SenderIdentityRow | null> {
    const row = await (trx || db)
      .selectFrom("tenant_email_sender_identities")
      .selectAll()
      .where("tenant_id", "=", tenantId)
      .where(column, "=", true)
      .where("status", "=", "ACTIVE")
      .executeTakeFirst();
    return row ?? null;
  }

  async listByTenant(tenantId: string): Promise<SenderIdentityRow[]> {
    return db
      .selectFrom("tenant_email_sender_identities")
      .selectAll()
      .where("tenant_id", "=", tenantId)
      .orderBy("created_at", "desc")
      .execute();
  }

  async create(
    input: CreateSenderIdentityRow,
    trx?: Transaction<DB>,
  ): Promise<SenderIdentityRow> {
    const id = ulid();
    const now = new Date();
    const row = await (trx || db)
      .insertInto("tenant_email_sender_identities")
      .values({
        id,
        tenant_id: input.tenantId,
        sending_domain_id: input.sendingDomainId,
        email_address: input.emailAddress,
        display_name: input.displayName,
        reply_to: input.replyTo,
        status: "ACTIVE",
        is_default_transactional: input.isDefaultTransactional,
        is_default_notification: input.isDefaultNotification,
        is_default_marketing: input.isDefaultMarketing,
        created_at: now,
        updated_at: now,
      })
      .returningAll()
      .executeTakeFirstOrThrow();
    return row;
  }

  async update(
    tenantId: string,
    id: string,
    patch: UpdateSenderIdentityRow,
    trx?: Transaction<DB>,
  ): Promise<SenderIdentityRow> {
    const updates: Record<string, unknown> = { updated_at: new Date() };
    if (patch.displayName !== undefined) {
      updates.display_name = patch.displayName;
    }
    if (patch.replyTo !== undefined) updates.reply_to = patch.replyTo;
    if (patch.status !== undefined) updates.status = patch.status;
    if (patch.isDefaultTransactional !== undefined) {
      updates.is_default_transactional = patch.isDefaultTransactional;
    }
    if (patch.isDefaultNotification !== undefined) {
      updates.is_default_notification = patch.isDefaultNotification;
    }
    if (patch.isDefaultMarketing !== undefined) {
      updates.is_default_marketing = patch.isDefaultMarketing;
    }
    const row = await (trx || db)
      .updateTable("tenant_email_sender_identities")
      .set(updates)
      .where("tenant_id", "=", tenantId)
      .where("id", "=", id)
      .returningAll()
      .executeTakeFirstOrThrow();
    return row;
  }

  /**
   * Clear the given category-default flag on every other ACTIVE identity for
   * this tenant. Use inside a transaction prior to applying the new default.
   */
  async clearCategoryDefaultExcept(
    tenantId: string,
    column: DefaultCategoryColumn,
    exceptId: string | null,
    trx: Transaction<DB>,
  ): Promise<void> {
    let query = trx
      .updateTable("tenant_email_sender_identities")
      .set({ [column]: false, updated_at: new Date() })
      .where("tenant_id", "=", tenantId)
      .where(column, "=", true);
    if (exceptId) {
      query = query.where("id", "!=", exceptId);
    }
    await query.execute();
  }
}

export default new EmailSenderIdentityRepository();
