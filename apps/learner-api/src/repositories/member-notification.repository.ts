import { ulid } from "ulid";
import type { Selectable, Transaction } from "kysely";
import { db } from "../db/connection";
import type { DB, member_notifications } from "../db/types";
import type { member_notification_type } from "../db/enums";

export type MemberNotificationRow = Selectable<member_notifications>;

export interface MemberNotificationsListParams {
  page?: number;
  limit?: number;
  type?: member_notification_type;
  isRead?: boolean;
}

export interface CreateMemberNotificationData {
  tenant_id: string;
  member_id: string;
  type: member_notification_type;
  title: string;
  message: string;
  action_url?: string | null;
  metadata?: Record<string, unknown> | null;
}

class MemberNotificationRepository {
  async create(
    data: CreateMemberNotificationData,
    trx?: Transaction<DB>
  ): Promise<MemberNotificationRow> {
    const id = ulid();
    const now = new Date();
    return (trx || db)
      .insertInto("member_notifications")
      .values({
        id,
        tenant_id: data.tenant_id,
        member_id: data.member_id,
        type: data.type,
        title: data.title,
        message: data.message,
        action_url: data.action_url ?? null,
        is_read: false,
        read_at: null,
        metadata: data.metadata ? JSON.stringify(data.metadata) : null,
        created_at: now,
        updated_at: now,
      } as never)
      .returningAll()
      .executeTakeFirstOrThrow();
  }

  async findAll(
    tenantId: string,
    memberId: string,
    params: MemberNotificationsListParams,
    trx?: Transaction<DB>
  ): Promise<{ items: MemberNotificationRow[]; total: number }> {
    const conn = trx || db;
    const page = params.page ?? 1;
    const limit = params.limit ?? 20;
    const offset = (page - 1) * limit;

    let query = conn
      .selectFrom("member_notifications")
      .selectAll()
      .where("tenant_id", "=", tenantId)
      .where("member_id", "=", memberId);

    let countQuery = conn
      .selectFrom("member_notifications")
      .select(db.fn.count<number>("id").as("count"))
      .where("tenant_id", "=", tenantId)
      .where("member_id", "=", memberId);

    if (params.type) {
      query = query.where("type", "=", params.type);
      countQuery = countQuery.where("type", "=", params.type);
    }
    if (params.isRead !== undefined) {
      query = query.where("is_read", "=", params.isRead);
      countQuery = countQuery.where("is_read", "=", params.isRead);
    }

    const [items, countResult] = await Promise.all([
      query.orderBy("created_at", "desc").limit(limit).offset(offset).execute(),
      countQuery.executeTakeFirst(),
    ]);

    const total =
      typeof countResult?.count === "string"
        ? parseInt(countResult.count, 10)
        : Number(countResult?.count ?? 0);

    return { items, total };
  }

  async countUnread(
    tenantId: string,
    memberId: string,
    trx?: Transaction<DB>
  ): Promise<number> {
    const result = await (trx || db)
      .selectFrom("member_notifications")
      .select(db.fn.count<number>("id").as("count"))
      .where("tenant_id", "=", tenantId)
      .where("member_id", "=", memberId)
      .where("is_read", "=", false)
      .executeTakeFirst();
    return typeof result?.count === "string"
      ? parseInt(result.count, 10)
      : Number(result?.count ?? 0);
  }

  async markRead(
    tenantId: string,
    memberId: string,
    id: string,
    trx?: Transaction<DB>
  ): Promise<MemberNotificationRow | undefined> {
    return (trx || db)
      .updateTable("member_notifications")
      .set({ is_read: true, read_at: new Date(), updated_at: new Date() } as never)
      .where("tenant_id", "=", tenantId)
      .where("member_id", "=", memberId)
      .where("id", "=", id)
      .returningAll()
      .executeTakeFirst();
  }

  async markAllRead(
    tenantId: string,
    memberId: string,
    trx?: Transaction<DB>
  ): Promise<void> {
    await (trx || db)
      .updateTable("member_notifications")
      .set({ is_read: true, read_at: new Date(), updated_at: new Date() } as never)
      .where("tenant_id", "=", tenantId)
      .where("member_id", "=", memberId)
      .where("is_read", "=", false)
      .execute();
  }

  async deleteById(
    tenantId: string,
    memberId: string,
    id: string,
    trx?: Transaction<DB>
  ): Promise<void> {
    await (trx || db)
      .deleteFrom("member_notifications")
      .where("tenant_id", "=", tenantId)
      .where("member_id", "=", memberId)
      .where("id", "=", id)
      .execute();
  }
}

export default new MemberNotificationRepository();
