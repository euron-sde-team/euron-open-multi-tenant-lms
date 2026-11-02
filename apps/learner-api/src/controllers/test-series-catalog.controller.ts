import type { Request, Response } from "express";
import { BadRequestError } from "../errors/bad-request.error";
import { HttpSuccessStatus, sendSuccessResponse } from "../utils/response.util";
import testSeriesCatalogService from "../services/test-series-catalog.service";
import testSeriesEnrollmentsRepository from "../repositories/test-series-enrollments.repository";

function requireTenant(req: Request): string {
  const tenantId = req.tenant?.id;
  if (!tenantId) throw new BadRequestError("Tenant context required");
  return tenantId;
}

export async function listCatalog(req: Request, res: Response): Promise<void> {
  const tenantId = requireTenant(req);
  // optionalAuth: present for signed-in learners, null for visitors. Drives the
  // per-card "already owned" state so a purchased series stops showing a price.
  const memberId = req.user?.id ?? null;
  const data = await testSeriesCatalogService.listCatalog(
    tenantId,
    {
      search: req.query.search as string | undefined,
      category: req.query.category as string | undefined,
      pricing: req.query.pricing as string | undefined,
      ordered: req.tenant?.orderedProducts === true,
    },
    memberId
  );
  sendSuccessResponse({
    res,
    data,
    statusCode: HttpSuccessStatus.OK,
    message: "Catalog retrieved",
  });
}

export async function getCatalogDetail(req: Request, res: Response): Promise<void> {
  const tenantId = requireTenant(req);
  const slug = (req.params.slug as string) ?? "";
  if (!slug) throw new BadRequestError("Slug is required");
  const memberId = req.user?.id ?? null;
  const data = await testSeriesCatalogService.getDetailBySlug(tenantId, slug, memberId);
  sendSuccessResponse({
    res,
    data,
    statusCode: HttpSuccessStatus.OK,
    message: "Series retrieved",
  });
}

export async function listMyEnrollments(req: Request, res: Response): Promise<void> {
  const tenantId = requireTenant(req);
  const memberId = req.user?.id;
  if (!memberId) throw new BadRequestError("Member required");
  const enrollments = await testSeriesEnrollmentsRepository.findByMember(
    tenantId,
    memberId
  );
  const data = enrollments.map((e) => ({
    id: e.id,
    testSeriesId: e.test_series_id,
    status: String(e.status),
    source: String(e.source),
    enrolledAt:
      e.enrolled_at instanceof Date
        ? e.enrolled_at.toISOString()
        : String(e.enrolled_at),
    validTill:
      e.valid_till instanceof Date
        ? e.valid_till.toISOString()
        : (e.valid_till as string | null),
  }));
  sendSuccessResponse({
    res,
    data,
    statusCode: HttpSuccessStatus.OK,
    message: "Enrollments retrieved",
  });
}
