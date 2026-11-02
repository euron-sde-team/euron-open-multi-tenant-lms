/**
 * Email messages service, read-side query over tenant_email_messages for
 * the tenant admin UI message log.
 *
 * Filters:
 *   - status (QUEUED / SENT / DELIVERED / BOUNCED / COMPLAINED / REJECTED /
 *             FAILED / SUPPRESSED / FROZEN)
 *   - category (TRANSACTIONAL / NOTIFICATION / MARKETING)
 *   - search (substring match on to_address or subject)
 *   - createdAfter / createdBefore (ISO date strings)
 *
 * Returns paginated results with a derived `total`. Page size capped at 200.
 */

import { sql } from "kysely";
import { db } from "../db/connection";
import type {
  email_message_category,
  email_message_status,
} from "../db/enums";

export interface ListMessagesParams {
  page?: number;
  limit?: number;
  status?: email_message_status;
  category?: email_message_category;
  search?: string;
  createdAfter?: Date;
  createdBefore?: Date;
}

export interface MessageRow {
  id: string;
  category: email_message_category;
  fromAddress: string;
  toAddress: string;
  subject: string;
  templateKey: string | null;
  campaignId: string | null;
  sesMessageId: string | null;
  status: email_message_status;
  bounceType: string | null;
  bounceSubType: string | null;
  complaintFeedbackType: string | null;
  deliveredAt: string | null;
  bouncedAt: string | null;
  complainedAt: string | null;
  openedAt: string | null;
  clickedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ListMessagesResult {
  messages: MessageRow[];
  total: number;
  page: number;
  limit: number;
}

class EmailMessagesService {
  async list(
    tenantId: string,
    params: ListMessagesParams = {},
  ): Promise<ListMessagesResult> {
    const page = Math.max(1, params.page ?? 1);
    const limit = Math.min(200, Math.max(1, params.limit ?? 50));
    const offset = (page - 1) * limit;

    let countQuery = db
      .selectFrom("tenant_email_messages")
      .select(db.fn.count<number>("id").as("count"))
      .where("tenant_id", "=", tenantId);

    let listQuery = db
      .selectFrom("tenant_email_messages")
      .selectAll()
      .where("tenant_id", "=", tenantId);

    if (params.status) {
      countQuery = countQuery.where("status", "=", params.status);
      listQuery = listQuery.where("status", "=", params.status);
    }
    if (params.category) {
      countQuery = countQuery.where("category", "=", params.category);
      listQuery = listQuery.where("category", "=", params.category);
    }
    if (params.search) {
      const pattern = `%${params.search.toLowerCase()}%`;
      countQuery = countQuery.where((eb) =>
        eb.or([
          eb("to_address", "like", pattern),
          eb(eb.fn("lower", ["subject"]), "like", pattern),
        ]),
      );
      listQuery = listQuery.where((eb) =>
        eb.or([
          eb("to_address", "like", pattern),
          eb(eb.fn("lower", ["subject"]), "like", pattern),
        ]),
      );
    }
    if (params.createdAfter) {
      countQuery = countQuery.where("created_at", ">=", params.createdAfter);
      listQuery = listQuery.where("created_at", ">=", params.createdAfter);
    }
    if (params.createdBefore) {
      countQuery = countQuery.where("created_at", "<=", params.createdBefore);
      listQuery = listQuery.where("created_at", "<=", params.createdBefore);
    }

    const [countResult, rows] = await Promise.all([
      countQuery.executeTakeFirst(),
      listQuery
        .orderBy("created_at", sql`DESC`)
        .limit(limit)
        .offset(offset)
        .execute(),
    ]);

    const messages: MessageRow[] = rows.map((r) => ({
      id: r.id,
      category: r.category,
      fromAddress: r.from_address,
      toAddress: r.to_address,
      subject: r.subject,
      templateKey: r.template_key,
      campaignId: r.campaign_id,
      sesMessageId: r.ses_message_id,
      status: r.status,
      bounceType: r.bounce_type,
      bounceSubType: r.bounce_sub_type,
      complaintFeedbackType: r.complaint_feedback_type,
      deliveredAt: r.delivered_at?.toISOString() ?? null,
      bouncedAt: r.bounced_at?.toISOString() ?? null,
      complainedAt: r.complained_at?.toISOString() ?? null,
      openedAt: r.opened_at?.toISOString() ?? null,
      clickedAt: r.clicked_at?.toISOString() ?? null,
      createdAt: r.created_at.toISOString(),
      updatedAt: r.updated_at.toISOString(),
    }));

    return {
      messages,
      total: Number(countResult?.count ?? 0),
      page,
      limit,
    };
  }
}

export default new EmailMessagesService();
