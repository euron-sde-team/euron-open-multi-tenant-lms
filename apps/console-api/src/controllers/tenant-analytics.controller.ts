import ExcelJS from "exceljs";
import { NextFunction, Request, Response } from "express";

import tenantAnalyticsService from "../services/tenant-analytics.service";
import {
  TenantActivityStatus,
  TenantAnalyticsQuery,
} from "../types/tenant-analytics.type";
import { HttpSuccessStatus, sendSuccessResponse } from "../utils/response.util";

const XLSX_CONTENT_TYPE =
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

const VALID_STATUS: TenantActivityStatus[] = ["active", "dormant", "inactive"];
const VALID_SORT = ["recent_activity", "name", "courses", "members", "created"];

const parseQuery = (req: Request): TenantAnalyticsQuery => {
  const status = req.query.status as string | undefined;
  const sort = req.query.sort as string | undefined;
  return {
    page: req.query.page ? parseInt(req.query.page as string, 10) : undefined,
    limit: req.query.limit ? parseInt(req.query.limit as string, 10) : undefined,
    search:
      typeof req.query.search === "string" && req.query.search.trim()
        ? req.query.search.trim()
        : undefined,
    status:
      status && VALID_STATUS.includes(status as TenantActivityStatus)
        ? (status as TenantActivityStatus)
        : undefined,
    sort: VALID_SORT.includes(sort ?? "")
      ? (sort as TenantAnalyticsQuery["sort"])
      : undefined,
    inactiveDays: req.query.inactiveDays
      ? parseInt(req.query.inactiveDays as string, 10)
      : undefined,
    planCode:
      typeof req.query.planCode === "string" && req.query.planCode.trim()
        ? req.query.planCode.trim()
        : undefined,
  };
};

/** GET /admin/tenant-analytics */
export const listTenantAnalytics = async (
  req: Request,
  res: Response,
  _next: NextFunction
): Promise<void> => {
  const data = await tenantAnalyticsService.listAnalytics(parseQuery(req));
  sendSuccessResponse({
    res,
    data,
    statusCode: HttpSuccessStatus.OK,
    message: "Tenant analytics retrieved successfully",
  });
};

/** GET /admin/tenant-analytics/:id */
export const getTenantAnalyticsDetail = async (
  req: Request,
  res: Response,
  _next: NextFunction
): Promise<void> => {
  const data = await tenantAnalyticsService.getTenantAnalytics(
    req.params.id as string
  );
  sendSuccessResponse({
    res,
    data,
    statusCode: HttpSuccessStatus.OK,
    message: "Tenant analytics detail retrieved successfully",
  });
};

/** GET /admin/tenant-analytics/export */
export const exportTenantAnalytics = async (
  req: Request,
  res: Response,
  _next: NextFunction
): Promise<void> => {
  const rows = await tenantAnalyticsService.listAllForExport(parseQuery(req));

  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Tenant Analytics");
  sheet.columns = [
    { header: "Tenant", key: "name", width: 28 },
    { header: "Slug", key: "slug", width: 22 },
    { header: "Owner Email", key: "ownerEmail", width: 30 },
    { header: "Owner Phone", key: "ownerPhone", width: 18 },
    { header: "Platform URL", key: "platformUrl", width: 38 },
    { header: "Custom URL", key: "customUrl", width: 32 },
    { header: "Activity Status", key: "activityStatus", width: 16 },
    { header: "Tenant Status", key: "status", width: 14 },
    { header: "Plan", key: "plan", width: 22 },
    { header: "Plan Code", key: "planCode", width: 14 },
    { header: "Subscription", key: "subscriptionStatus", width: 14 },
    { header: "Valid Until", key: "validUntil", width: 22 },
    { header: "Members", key: "memberCount", width: 12 },
    { header: "Recent Logins", key: "recentLoginCount", width: 14 },
    { header: "Active Apps", key: "activeAppCount", width: 12 },
    { header: "Courses", key: "courseCount", width: 10 },
    { header: "Last Activity", key: "lastActivityAt", width: 22 },
    { header: "Created", key: "createdAt", width: 22 },
  ];
  sheet.getRow(1).font = { bold: true };
  const fmt = (d: string | null) => (d ? d.replace("T", " ").slice(0, 19) : "");
  for (const r of rows) {
    sheet.addRow({
      ...r,
      ownerEmail: r.ownerEmail ?? "",
      ownerPhone: r.ownerPhone ?? "",
      platformUrl: r.platformUrl ?? "",
      customUrl: r.customUrl ?? "",
      validUntil: fmt(r.validUntil),
      lastActivityAt: fmt(r.lastActivityAt),
      createdAt: fmt(r.createdAt),
    });
  }

  const buffer = await workbook.xlsx.writeBuffer();
  const date = new Date().toISOString().slice(0, 10);
  res.setHeader("Content-Type", XLSX_CONTENT_TYPE);
  res.setHeader(
    "Content-Disposition",
    `attachment; filename="tenant-analytics-${date}.xlsx"`
  );
  res.send(Buffer.from(buffer));
};

/** POST /admin/tenant-analytics/:id/send-email */
export const sendTenantEmail = async (
  req: Request,
  res: Response,
  _next: NextFunction
): Promise<void> => {
  const { to, subject, html } = req.body ?? {};
  const result = await tenantAnalyticsService.sendTenantEmail(
    req.params.id as string,
    { to, subject, html }
  );
  sendSuccessResponse({
    res,
    data: result,
    statusCode: HttpSuccessStatus.OK,
    message: `Email sent to ${result.to}`,
  });
};
