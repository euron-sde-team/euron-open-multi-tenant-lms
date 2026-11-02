import type { NextFunction, Request, Response } from "express";
import { db } from "../db/connection";
import { sendSuccessResponse } from "../utils/response.util";
import { getTenantBaseUrl } from "../utils/tenant-domain.util";

export const getMyCertificates = async (
  req: Request,
  res: Response,
  _next: NextFunction
) => {
  const tenantId = req.tenant!.id;
  const memberId = req.user!.id;
  // Tenant's real public domain (tenant_domains primary ACTIVE), used to build
  // each certificate's verify URL so the profile "copy link" points at the
  // owning tenant's domain, not whatever origin the browser happens to be on.
  const baseUrl = await getTenantBaseUrl(tenantId);

  // Course-completion certificates earned by this learner.
  const courseCerts = await db
    .selectFrom("certificates as c")
    .innerJoin("courses as co", "co.id", "c.course_id")
    .select([
      "c.id",
      "c.certificate_number",
      "c.course_id",
      "co.title as course_title",
      "c.status",
      "c.issued_at",
    ])
    .where("c.tenant_id", "=", tenantId)
    .where("c.tenant_member_id", "=", memberId)
    .where("c.status", "=", "ISSUED")
    .execute();

  // Bulk-issued certificates mapped to this learner's account by email.
  const bulkCerts = await db
    .selectFrom("bulk_certificates as b")
    .innerJoin("certificate_batches as cb", "cb.id", "b.batch_id")
    .select([
      "b.id",
      "b.certificate_number",
      "cb.title as batch_title",
      "b.status",
      "b.issued_at",
    ])
    .where("b.tenant_id", "=", tenantId)
    .where("b.tenant_member_id", "=", memberId)
    .where("b.status", "=", "ISSUED")
    .execute();

  // Test-series certificates earned by this learner (title from the series, or
  // the individual test as a fallback).
  const testCerts = await db
    .selectFrom("test_certificates as tc")
    .leftJoin("test_series as ts", "ts.id", "tc.test_series_id")
    .leftJoin("tests as t", "t.id", "tc.test_id")
    .select([
      "tc.id",
      "tc.certificate_number",
      "tc.status",
      "tc.issued_at",
      "ts.title as series_title",
      "t.name as test_name",
    ])
    .where("tc.tenant_id", "=", tenantId)
    .where("tc.tenant_member_id", "=", memberId)
    .where("tc.status", "=", "ISSUED")
    .execute();

  const items = [
    ...courseCerts.map((c) => ({
      id: c.id,
      certificateNumber: c.certificate_number,
      type: "COURSE" as const,
      title: c.course_title,
      courseId: c.course_id,
      courseTitle: c.course_title,
      status: c.status,
      issuedAt: c.issued_at.toISOString(),
      verifyUrl: `${baseUrl}/certificate/${c.certificate_number}`,
    })),
    ...bulkCerts.map((b) => ({
      id: b.id,
      certificateNumber: b.certificate_number,
      type: "BULK" as const,
      title: b.batch_title,
      courseId: null,
      courseTitle: null,
      status: b.status,
      issuedAt: b.issued_at.toISOString(),
      verifyUrl: `${baseUrl}/certificate/${b.certificate_number}`,
    })),
    ...testCerts.map((t) => ({
      id: t.id,
      certificateNumber: t.certificate_number,
      type: "TEST_SERIES" as const,
      title: t.series_title ?? t.test_name ?? "Test certificate",
      courseId: null,
      courseTitle: null,
      status: t.status,
      issuedAt: t.issued_at.toISOString(),
      verifyUrl: `${baseUrl}/certificate/${t.certificate_number}`,
    })),
  ].sort((a, b) => (a.issuedAt < b.issuedAt ? 1 : -1));

  sendSuccessResponse({
    res,
    data: items,
    statusCode: 200,
    message: "Certificates retrieved",
  });
};
