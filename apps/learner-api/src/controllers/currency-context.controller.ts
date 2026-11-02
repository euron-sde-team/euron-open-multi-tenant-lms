import type { Request, Response } from "express";

import { BadRequestError } from "../errors/bad-request.error";
import tenantOrgRepository from "../repositories/tenant-org.repository";
import {
  CurrencyContextResult,
  resolveCurrencyContext,
  setMemberCurrencyPreference,
} from "../services/currency-context.service";
import { HttpSuccessStatus, sendSuccessResponse } from "../utils/response.util";

function clientIp(req: Request): string | null {
  const xff = req.headers["x-forwarded-for"];
  if (typeof xff === "string" && xff.length > 0) {
    const first = xff.split(",")[0]?.trim();
    if (first) return first;
  }
  return req.ip ?? req.socket?.remoteAddress ?? null;
}

/**
 * Access-managed storefront context rides on /currency-context because the
 * web app's CurrencyProvider already wraps every page, one fetch gives the
 * browser both the currency and the "hide prices" signal. The support email
 * (mailto target of the Contact Support CTA) is only fetched when the flag
 * is on, so normal tenants pay no extra query.
 */
async function withStorefrontContext(
  req: Request,
  result: CurrencyContextResult,
): Promise<
  CurrencyContextResult & {
    access_managed: boolean;
    support_email: string | null;
    certificate_tab_enabled: boolean;
    enrolled_courses_only_enabled: boolean;
  }
> {
  const accessManaged = req.tenant?.accessManaged ?? false;
  // Default ON: only an explicit opt-out disables the certificates tab.
  const certificateTabEnabled = req.tenant?.certificateTabEnabled !== false;
  // Default OFF: only an explicit opt-in restricts jobs to org-posted only.
  // Default OFF: only an explicit opt-in restricts learners to enrolled courses.
  const enrolledCoursesOnly = req.tenant?.enrolledCoursesOnly === true;
  let supportEmail: string | null = null;
  if (accessManaged && req.tenant?.id) {
    const org = await tenantOrgRepository.findByTenantId(req.tenant.id);
    supportEmail = org?.support_email || org?.contact_email || null;
  }
  return {
    ...result,
    access_managed: accessManaged,
    support_email: supportEmail,
    certificate_tab_enabled: certificateTabEnabled,
    enrolled_courses_only_enabled: enrolledCoursesOnly,
  };
}

export async function getCurrencyContext(req: Request, res: Response): Promise<void> {
  const tenantId = req.tenant?.id;
  if (!tenantId) throw new BadRequestError("Tenant required");

  const cfCountry = req.headers["cf-ipcountry"];
  const result = await resolveCurrencyContext(tenantId, {
    memberId: req.user?.id ?? null,
    cfCountry: typeof cfCountry === "string" ? cfCountry : null,
    ip: clientIp(req),
    tz: typeof req.query.tz === "string" ? req.query.tz : null,
  });
  sendSuccessResponse({
    res,
    data: await withStorefrontContext(req, result),
    statusCode: HttpSuccessStatus.OK,
    message: "Currency context resolved",
  });
}

export async function updateCurrencyPreference(req: Request, res: Response): Promise<void> {
  const tenantId = req.tenant?.id;
  const memberId = req.user?.id;
  if (!tenantId || !memberId) throw new BadRequestError("Tenant and user required");

  await setMemberCurrencyPreference(tenantId, memberId, String(req.body?.currency ?? ""));
  const result = await resolveCurrencyContext(tenantId, { memberId, ip: clientIp(req) });
  sendSuccessResponse({
    res,
    data: await withStorefrontContext(req, result),
    statusCode: HttpSuccessStatus.OK,
    message: "Currency preference updated",
  });
}
