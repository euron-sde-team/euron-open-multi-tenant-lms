import { Request, Response } from "express";

import { BadRequestError } from "../errors/bad-request.error";
import bulkEnrollService from "../services/bulk-enroll.service";
import memberCourseAnalyticsExportService from "../services/member-course-analytics-export.service";
import memberCourseAnalyticsService from "../services/member-course-analytics.service";
import membersService from "../services/members.service";
import { IResponseFormat } from "../types/response.type";
import { HttpSuccessStatus, sendSuccessResponse } from "../utils/response.util";

const requireTenantId = (req: Request): string => {
  if (!req.tenantId) throw new BadRequestError("Tenant context required");
  return req.tenantId;
};

export const listMembers = async (
  req: Request,
  res: Response<IResponseFormat>
) => {
  const tenantId = requireTenantId(req);
  const page = Math.max(1, parseInt(req.query.page as string, 10) || 1);
  const limit = Math.min(
    100,
    Math.max(1, parseInt(req.query.limit as string, 10) || 20)
  );
  const search = (req.query.search as string) || undefined;
  const status = (req.query.status as string) || undefined;
  const sortBy = (req.query.sortBy as string) || "joined_at";
  const sortOrder =
    (req.query.sortOrder as string) === "asc" ? "asc" : "desc";

  const result = await membersService.listMembers({
    tenantId,
    page,
    limit,
    search,
    status,
    sortBy,
    sortOrder,
  });

  sendSuccessResponse({
    res,
    data: result,
    statusCode: HttpSuccessStatus.OK,
    message: "Members retrieved successfully",
  });
};

export const getMember = async (
  req: Request,
  res: Response<IResponseFormat>
) => {
  const tenantId = requireTenantId(req);
  const member = await membersService.getMember(tenantId, req.params.memberId as string);

  sendSuccessResponse({
    res,
    data: member,
    statusCode: HttpSuccessStatus.OK,
    message: "Member retrieved successfully",
  });
};

export const createMember = async (
  req: Request,
  res: Response<IResponseFormat>
) => {
  const tenantId = requireTenantId(req);
  const { name, email, phone } = (req.body ?? {}) as Record<string, unknown>;

  const member = await membersService.createSingleMember(
    tenantId,
    req.tenantUser.id,
    { name, email, phone }
  );

  sendSuccessResponse({
    res,
    data: member,
    statusCode: HttpSuccessStatus.CREATED,
    message: "Member added successfully",
  });
};

export const updateMemberStatus = async (
  req: Request,
  res: Response<IResponseFormat>
) => {
  const tenantId = requireTenantId(req);
  const { status } = req.body;
  if (!status) throw new BadRequestError("status is required");

  await membersService.updateMemberStatus(
    tenantId,
    req.params.memberId as string,
    status
  );

  sendSuccessResponse({
    res,
    data: null,
    statusCode: HttpSuccessStatus.OK,
    message: "Member status updated successfully",
  });
};

export const updateMemberProfile = async (
  req: Request,
  res: Response<IResponseFormat>
) => {
  const tenantId = requireTenantId(req);
  const { name, email, phone, keepEmailVerified, keepPhoneVerified } =
    (req.body ?? {}) as Record<string, unknown>;

  if (
    name === undefined &&
    email === undefined &&
    phone === undefined
  ) {
    throw new BadRequestError(
      "At least one of name, email, or phone must be provided"
    );
  }

  const updated = await membersService.updateMemberProfile(
    tenantId,
    req.params.memberId as string,
    { name, email, phone, keepEmailVerified, keepPhoneVerified }
  );

  sendSuccessResponse({
    res,
    data: updated,
    statusCode: HttpSuccessStatus.OK,
    message: "Member profile updated successfully",
  });
};

export const getMemberEnrollments = async (
  req: Request,
  res: Response<IResponseFormat>
) => {
  const tenantId = requireTenantId(req);
  const enrollments = await membersService.getMemberEnrollments(
    tenantId,
    req.params.memberId as string
  );

  sendSuccessResponse({
    res,
    data: enrollments,
    statusCode: HttpSuccessStatus.OK,
    message: "Enrollments retrieved successfully",
  });
};

export const getMemberBookAccess = async (
  req: Request,
  res: Response<IResponseFormat>
) => {
  const tenantId = requireTenantId(req);
  const access = await membersService.getMemberBookAccess(
    tenantId,
    req.params.memberId as string
  );

  sendSuccessResponse({
    res,
    data: access,
    statusCode: HttpSuccessStatus.OK,
    message: "Book access retrieved successfully",
  });
};

export const getMemberOrders = async (
  req: Request,
  res: Response<IResponseFormat>
) => {
  const tenantId = requireTenantId(req);
  const orders = await membersService.getMemberOrders(
    tenantId,
    req.params.memberId as string
  );

  sendSuccessResponse({
    res,
    data: orders,
    statusCode: HttpSuccessStatus.OK,
    message: "Orders retrieved successfully",
  });
};

export const getMemberCertificates = async (
  req: Request,
  res: Response<IResponseFormat>
) => {
  const tenantId = requireTenantId(req);
  const certificates = await membersService.getMemberCertificates(
    tenantId,
    req.params.memberId as string
  );

  sendSuccessResponse({
    res,
    data: certificates,
    statusCode: HttpSuccessStatus.OK,
    message: "Certificates retrieved successfully",
  });
};

export const getMemberStats = async (
  req: Request,
  res: Response<IResponseFormat>
) => {
  const tenantId = requireTenantId(req);
  const stats = await membersService.getMemberStats(tenantId);

  sendSuccessResponse({
    res,
    data: stats,
    statusCode: HttpSuccessStatus.OK,
    message: "Member stats retrieved successfully",
  });
};

export const grantCourseAccess = async (
  req: Request,
  res: Response<IResponseFormat>
) => {
  const tenantId = requireTenantId(req);
  const { courseId } = req.body;
  if (!courseId) throw new BadRequestError("courseId is required");

  await membersService.grantCourseAccess(
    tenantId,
    req.params.memberId as string,
    courseId
  );

  sendSuccessResponse({
    res,
    data: null,
    statusCode: HttpSuccessStatus.CREATED,
    message: "Course access granted successfully",
  });
};

export const revokeCourseAccess = async (
  req: Request,
  res: Response<IResponseFormat>
) => {
  const tenantId = requireTenantId(req);

  await membersService.revokeCourseAccess(
    tenantId,
    req.params.memberId as string,
    req.params.enrollmentId as string
  );

  sendSuccessResponse({
    res,
    data: null,
    statusCode: HttpSuccessStatus.OK,
    message: "Course access revoked successfully",
  });
};

export const grantBookAccess = async (
  req: Request,
  res: Response<IResponseFormat>
) => {
  const tenantId = requireTenantId(req);
  const { bookId } = req.body;
  if (!bookId) throw new BadRequestError("bookId is required");

  await membersService.grantBookAccess(
    tenantId,
    req.params.memberId as string,
    bookId
  );

  sendSuccessResponse({
    res,
    data: null,
    statusCode: HttpSuccessStatus.CREATED,
    message: "Book access granted successfully",
  });
};

export const revokeBookAccess = async (
  req: Request,
  res: Response<IResponseFormat>
) => {
  const tenantId = requireTenantId(req);

  await membersService.revokeBookAccess(
    tenantId,
    req.params.memberId as string,
    req.params.accessId as string
  );

  sendSuccessResponse({
    res,
    data: null,
    statusCode: HttpSuccessStatus.OK,
    message: "Book access revoked successfully",
  });
};

// ─── Batch / test series / bundle access ──────────
// Grants delegate to bulkEnrollService.grantSingle, the same engine as the
// bulk-enroll flow, run for one member.

const grantViaTargetEngine = (
  targetType: "BATCH" | "TEST_SERIES" | "BUNDLE",
  bodyKey: string,
  successMessage: string,
) => {
  return async (req: Request, res: Response<IResponseFormat>) => {
    const tenantId = requireTenantId(req);
    const targetId = (req.body ?? {})[bodyKey];
    if (!targetId || typeof targetId !== "string") {
      throw new BadRequestError(`${bodyKey} is required`);
    }
    const validTill = parseValidTillBody(req.body);

    const action = await bulkEnrollService.grantSingle(
      tenantId,
      targetType,
      targetId,
      req.params.memberId as string,
      validTill,
    );

    sendSuccessResponse({
      res,
      data: { action },
      statusCode: HttpSuccessStatus.CREATED,
      message: successMessage,
    });
  };
};

export const grantBatchAccess = grantViaTargetEngine("BATCH", "batchId", "Batch access granted successfully");
export const grantTestSeriesAccess = grantViaTargetEngine("TEST_SERIES", "testSeriesId", "Test series access granted successfully");
export const grantBundleAccess = grantViaTargetEngine("BUNDLE", "bundleId", "Bundle access granted successfully");

export const getMemberBatchEnrollments = async (
  req: Request,
  res: Response<IResponseFormat>
) => {
  const tenantId = requireTenantId(req);
  const enrollments = await membersService.getMemberBatchEnrollments(
    tenantId,
    req.params.memberId as string
  );
  sendSuccessResponse({
    res,
    data: enrollments,
    statusCode: HttpSuccessStatus.OK,
    message: "Batch enrollments retrieved successfully",
  });
};

export const revokeBatchAccess = async (
  req: Request,
  res: Response<IResponseFormat>
) => {
  const tenantId = requireTenantId(req);
  await membersService.revokeBatchAccess(
    tenantId,
    req.params.memberId as string,
    req.params.enrollmentId as string
  );
  sendSuccessResponse({
    res,
    data: null,
    statusCode: HttpSuccessStatus.OK,
    message: "Batch access revoked successfully",
  });
};

export const updateBatchEnrollmentValidity = async (
  req: Request,
  res: Response<IResponseFormat>
) => {
  const tenantId = requireTenantId(req);
  await membersService.updateBatchEnrollmentValidity(
    tenantId,
    req.params.memberId as string,
    req.params.enrollmentId as string,
    parseValidTillBody(req.body)
  );
  sendSuccessResponse({
    res,
    data: null,
    statusCode: HttpSuccessStatus.OK,
    message: "Batch enrollment validity updated successfully",
  });
};

export const getMemberTestSeriesEnrollments = async (
  req: Request,
  res: Response<IResponseFormat>
) => {
  const tenantId = requireTenantId(req);
  const enrollments = await membersService.getMemberTestSeriesEnrollments(
    tenantId,
    req.params.memberId as string
  );
  sendSuccessResponse({
    res,
    data: enrollments,
    statusCode: HttpSuccessStatus.OK,
    message: "Test series enrollments retrieved successfully",
  });
};

export const revokeTestSeriesAccess = async (
  req: Request,
  res: Response<IResponseFormat>
) => {
  const tenantId = requireTenantId(req);
  await membersService.revokeTestSeriesAccess(
    tenantId,
    req.params.memberId as string,
    req.params.enrollmentId as string
  );
  sendSuccessResponse({
    res,
    data: null,
    statusCode: HttpSuccessStatus.OK,
    message: "Test series access revoked successfully",
  });
};

export const updateTestSeriesEnrollmentValidity = async (
  req: Request,
  res: Response<IResponseFormat>
) => {
  const tenantId = requireTenantId(req);
  await membersService.updateTestSeriesEnrollmentValidity(
    tenantId,
    req.params.memberId as string,
    req.params.enrollmentId as string,
    parseValidTillBody(req.body)
  );
  sendSuccessResponse({
    res,
    data: null,
    statusCode: HttpSuccessStatus.OK,
    message: "Test series enrollment validity updated successfully",
  });
};

/**
 * Body: { valid_till: ISO string | null }. Null clears the expiry (lifetime).
 * Strings are parsed strictly; bad input → 400.
 */
function parseValidTillBody(body: unknown): Date | null {
  const value = (body as { valid_till?: unknown } | null)?.valid_till;
  if (value === null || value === undefined || value === "") return null;
  if (typeof value !== "string") {
    throw new BadRequestError("valid_till must be an ISO date string or null");
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    throw new BadRequestError("valid_till is not a valid date");
  }
  return parsed;
}

export const updateEnrollmentValidity = async (
  req: Request,
  res: Response<IResponseFormat>
) => {
  const tenantId = requireTenantId(req);
  const validTill = parseValidTillBody(req.body);

  await membersService.updateEnrollmentValidity(
    tenantId,
    req.params.memberId as string,
    req.params.enrollmentId as string,
    validTill
  );

  sendSuccessResponse({
    res,
    data: null,
    statusCode: HttpSuccessStatus.OK,
    message: "Enrollment validity updated",
  });
};

export const updateBookAccessValidity = async (
  req: Request,
  res: Response<IResponseFormat>
) => {
  const tenantId = requireTenantId(req);
  const validTill = parseValidTillBody(req.body);

  await membersService.updateBookAccessValidity(
    tenantId,
    req.params.memberId as string,
    req.params.accessId as string,
    validTill
  );

  sendSuccessResponse({
    res,
    data: null,
    statusCode: HttpSuccessStatus.OK,
    message: "Book access validity updated",
  });
};

export const getPublishedCourses = async (
  req: Request,
  res: Response<IResponseFormat>
) => {
  const tenantId = requireTenantId(req);
  const courses = await membersService.getPublishedCourses(tenantId);

  sendSuccessResponse({
    res,
    data: courses,
    statusCode: HttpSuccessStatus.OK,
  });
};

export const getMemberDetailStats = async (
  req: Request,
  res: Response<IResponseFormat>
) => {
  const tenantId = requireTenantId(req);
  const data = await membersService.getMemberDetailStats(
    tenantId,
    req.params.memberId as string
  );

  sendSuccessResponse({
    res,
    data,
    statusCode: HttpSuccessStatus.OK,
    message: "Member detail stats retrieved",
  });
};

export const getMemberCartItems = async (
  req: Request,
  res: Response<IResponseFormat>
) => {
  const tenantId = requireTenantId(req);
  const data = await membersService.getMemberCartItems(
    tenantId,
    req.params.memberId as string
  );

  sendSuccessResponse({
    res,
    data,
    statusCode: HttpSuccessStatus.OK,
    message: "Cart items retrieved",
  });
};

export const getMemberCouponRedemptions = async (
  req: Request,
  res: Response<IResponseFormat>
) => {
  const tenantId = requireTenantId(req);
  const data = await membersService.getMemberCouponRedemptions(
    tenantId,
    req.params.memberId as string
  );

  sendSuccessResponse({
    res,
    data,
    statusCode: HttpSuccessStatus.OK,
    message: "Coupon redemptions retrieved",
  });
};

export const getMemberRefunds = async (
  req: Request,
  res: Response<IResponseFormat>
) => {
  const tenantId = requireTenantId(req);
  const data = await membersService.getMemberRefunds(
    tenantId,
    req.params.memberId as string
  );

  sendSuccessResponse({
    res,
    data,
    statusCode: HttpSuccessStatus.OK,
    message: "Refunds retrieved",
  });
};

export const getPublishedBooks = async (
  req: Request,
  res: Response<IResponseFormat>
) => {
  const tenantId = requireTenantId(req);
  const books = await membersService.getPublishedBooks(tenantId);

  sendSuccessResponse({
    res,
    data: books,
    statusCode: HttpSuccessStatus.OK,
  });
};

export const getMemberCourseAnalyticsSummary = async (
  req: Request,
  res: Response<IResponseFormat>
) => {
  const tenantId = requireTenantId(req);
  const data = await memberCourseAnalyticsService.getCourseSummary(
    tenantId,
    req.params.memberId as string
  );

  sendSuccessResponse({
    res,
    data,
    statusCode: HttpSuccessStatus.OK,
    message: "Course analytics summary retrieved",
  });
};

export const getMemberCourseAnalyticsDetail = async (
  req: Request,
  res: Response<IResponseFormat>
) => {
  const tenantId = requireTenantId(req);
  const data = await memberCourseAnalyticsService.getCourseDetail(
    tenantId,
    req.params.memberId as string,
    req.params.courseId as string
  );

  sendSuccessResponse({
    res,
    data,
    statusCode: HttpSuccessStatus.OK,
    message: "Course analytics detail retrieved",
  });
};

export const getMemberQuizAnalytics = async (
  req: Request,
  res: Response<IResponseFormat>
) => {
  const tenantId = requireTenantId(req);
  const data = await memberCourseAnalyticsService.getQuizAnalytics(
    tenantId,
    req.params.memberId as string
  );

  sendSuccessResponse({
    res,
    data,
    statusCode: HttpSuccessStatus.OK,
    message: "Quiz analytics retrieved",
  });
};

export const getMemberAssignmentAnalytics = async (
  req: Request,
  res: Response<IResponseFormat>
) => {
  const tenantId = requireTenantId(req);
  const data = await memberCourseAnalyticsService.getAssignmentAnalytics(
    tenantId,
    req.params.memberId as string
  );

  sendSuccessResponse({
    res,
    data,
    statusCode: HttpSuccessStatus.OK,
    message: "Assignment analytics retrieved",
  });
};

export const getMemberCourseAnalyticsExport = async (
  req: Request,
  res: Response<IResponseFormat>
) => {
  const tenantId = requireTenantId(req);
  const data = await memberCourseAnalyticsService.getExportPayload(
    tenantId,
    req.params.memberId as string
  );

  sendSuccessResponse({
    res,
    data,
    statusCode: HttpSuccessStatus.OK,
    message: "Course analytics export payload retrieved",
  });
};

/**
 * Binary .xlsx download: rich 5-sheet workbook (profile + KPIs, course
 * summary, section analytics, lecture detail, daily activity) with data bars
 * and color scales. Does NOT use sendSuccessResponse because it streams a
 * binary body, not the JSON envelope.
 */
export const downloadMemberCourseAnalyticsXlsx = async (
  req: Request,
  res: Response
) => {
  const tenantId = requireTenantId(req);
  const { buffer, fileName } =
    await memberCourseAnalyticsExportService.buildWorkbook(
      tenantId,
      req.params.memberId as string
    );

  res.setHeader(
    "Content-Type",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
  );
  res.setHeader(
    "Content-Disposition",
    `attachment; filename="${fileName}"`
  );
  res.setHeader("Content-Length", buffer.length.toString());
  res.status(HttpSuccessStatus.OK).end(buffer);
};
