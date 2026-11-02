import { Request, Response } from "express";
import { db } from "../db/connection";
import { ForbiddenError } from "../errors/forbidden.error";
import { getRates } from "../services/email-engine/reputation-metrics.service";
import { HttpSuccessStatus, sendSuccessResponse } from "../utils/response.util";
import type { IResponseFormat } from "../types/response.type";

function getTenantId(req: Request): string {
  const tenantId = req.tenantId;
  if (!tenantId) {
    throw new ForbiddenError("Tenant context required");
  }
  return tenantId;
}

export const getReputationOverview = async (
  req: Request,
  res: Response<IResponseFormat>,
) => {
  const tenantId = getTenantId(req);

  const tenant = await db
    .selectFrom("tenants")
    .select([
      "email_sending_status",
      "email_sending_status_changed_at",
      "email_marketing_blocked_reason",
    ])
    .where("id", "=", tenantId)
    .executeTakeFirst();

  const rates = await getRates(tenantId);
  const recentEvents = await db
    .selectFrom("tenant_email_reputation_events")
    .selectAll()
    .where("tenant_id", "=", tenantId)
    .orderBy("created_at", "desc")
    .limit(10)
    .execute();

  sendSuccessResponse({
    res,
    statusCode: HttpSuccessStatus.OK,
    message: "Email reputation retrieved",
    data: {
      status: tenant?.email_sending_status ?? "ACTIVE",
      statusChangedAt:
        tenant?.email_sending_status_changed_at?.toISOString() ?? null,
      marketingBlockedReason: tenant?.email_marketing_blocked_reason ?? null,
      rates: {
        windowStart: rates.windowStart.toISOString(),
        windowEnd: rates.windowEnd.toISOString(),
        sent: rates.sent,
        delivered: rates.delivered,
        bouncedPerm: rates.bouncedPerm,
        bouncedTrans: rates.bouncedTrans,
        complained: rates.complained,
        opened: rates.opened,
        clicked: rates.clicked,
        permBounceRate: rates.permBounceRate,
        complaintRate: rates.complaintRate,
        deliveryRate: rates.deliveryRate,
        openRate: rates.openRate,
      },
      recentEvents: recentEvents.map((e) => ({
        id: e.id,
        fromStatus: e.from_status,
        toStatus: e.to_status,
        trigger: e.trigger,
        triggeredBy: e.triggered_by,
        reason: e.reason,
        ratesSnapshot: e.rates_snapshot,
        createdAt: e.created_at.toISOString(),
      })),
    },
  });
};

export const getReputationHistory = async (
  req: Request,
  res: Response<IResponseFormat>,
) => {
  const tenantId = getTenantId(req);
  const limit = Math.min(
    200,
    Math.max(1, parseInt((req.query.limit as string) ?? "50", 10) || 50),
  );
  const page = Math.max(1, parseInt((req.query.page as string) ?? "1", 10) || 1);
  const offset = (page - 1) * limit;

  const [countResult, rows] = await Promise.all([
    db
      .selectFrom("tenant_email_reputation_events")
      .select(db.fn.count<number>("id").as("count"))
      .where("tenant_id", "=", tenantId)
      .executeTakeFirst(),
    db
      .selectFrom("tenant_email_reputation_events")
      .selectAll()
      .where("tenant_id", "=", tenantId)
      .orderBy("created_at", "desc")
      .limit(limit)
      .offset(offset)
      .execute(),
  ]);

  sendSuccessResponse({
    res,
    statusCode: HttpSuccessStatus.OK,
    message: "Email reputation history retrieved",
    data: {
      total: Number(countResult?.count ?? 0),
      page,
      limit,
      events: rows.map((e) => ({
        id: e.id,
        fromStatus: e.from_status,
        toStatus: e.to_status,
        trigger: e.trigger,
        triggeredBy: e.triggered_by,
        reason: e.reason,
        ratesSnapshot: e.rates_snapshot,
        createdAt: e.created_at.toISOString(),
      })),
    },
  });
};
