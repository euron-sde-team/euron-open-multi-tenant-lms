import type { ApiResponse } from "../types/auth";
import type {
  MembersListResult,
  MembersListParams,
  MemberDetail,
  MemberEnrollment,
  MemberBookAccess,
  MemberOrder,
  MemberCertificate,
  MemberStats,
  PublishedCourse,
  PublishedBook,
  MemberBatchEnrollment,
  MemberTestSeriesEnrollment,
  MemberAccessGrantAction,
  MemberDetailStats,
  MemberCartItem,
  MemberCouponRedemption,
  MemberRefund,
  MemberCourseAnalyticsSummary,
  MemberCourseAnalyticsDetail,
  MemberCourseAnalyticsExportPayload,
  MemberCourseAnalyticsSyncResult,
  MemberQuizAnalyticsResponse,
  MemberAssignmentAnalyticsResponse,
} from "../types/members";

import { apiClient } from "./axios";

async function listMembers(
  params: MembersListParams
): Promise<MembersListResult> {
  const response = await apiClient.get<ApiResponse<MembersListResult>>(
    "/tenant/members",
    { params }
  );
  return response.data.data;
}

async function getMember(memberId: string): Promise<MemberDetail> {
  const response = await apiClient.get<ApiResponse<MemberDetail>>(
    `/tenant/members/${memberId}`
  );
  return response.data.data;
}

async function updateMemberStatus(
  memberId: string,
  status: string
): Promise<void> {
  await apiClient.patch(`/tenant/members/${memberId}/status`, { status });
}

export interface CreateMemberInput {
  name: string;
  email?: string;
  phone?: string;
}

async function createMember(input: CreateMemberInput): Promise<MemberDetail> {
  const response = await apiClient.post<ApiResponse<MemberDetail>>(
    "/tenant/members",
    input
  );
  return response.data.data;
}

export interface UpdateMemberProfileInput {
  name?: string;
  email?: string | null;
  phone?: string | null;
  keepEmailVerified?: boolean;
  keepPhoneVerified?: boolean;
}

async function updateMemberProfile(
  memberId: string,
  input: UpdateMemberProfileInput
): Promise<MemberDetail> {
  const response = await apiClient.patch<ApiResponse<MemberDetail>>(
    `/tenant/members/${memberId}/profile`,
    input
  );
  return response.data.data;
}

async function getMemberEnrollments(
  memberId: string
): Promise<MemberEnrollment[]> {
  const response = await apiClient.get<ApiResponse<MemberEnrollment[]>>(
    `/tenant/members/${memberId}/enrollments`
  );
  return response.data.data;
}

async function getMemberBookAccess(
  memberId: string
): Promise<MemberBookAccess[]> {
  const response = await apiClient.get<ApiResponse<MemberBookAccess[]>>(
    `/tenant/members/${memberId}/book-access`
  );
  return response.data.data;
}

async function getMemberOrders(memberId: string): Promise<MemberOrder[]> {
  const response = await apiClient.get<ApiResponse<MemberOrder[]>>(
    `/tenant/members/${memberId}/orders`
  );
  return response.data.data;
}

async function getMemberCertificates(
  memberId: string
): Promise<MemberCertificate[]> {
  const response = await apiClient.get<ApiResponse<MemberCertificate[]>>(
    `/tenant/members/${memberId}/certificates`
  );
  return response.data.data;
}

async function getMemberStats(): Promise<MemberStats> {
  const response = await apiClient.get<ApiResponse<MemberStats>>(
    "/tenant/members/stats"
  );
  return response.data.data;
}

async function grantCourseAccess(
  memberId: string,
  courseId: string
): Promise<void> {
  await apiClient.post(`/tenant/members/${memberId}/enrollments`, {
    courseId,
  });
}

async function revokeCourseAccess(
  memberId: string,
  enrollmentId: string
): Promise<void> {
  await apiClient.delete(
    `/tenant/members/${memberId}/enrollments/${enrollmentId}`
  );
}

async function grantBookAccess(
  memberId: string,
  bookId: string
): Promise<void> {
  await apiClient.post(`/tenant/members/${memberId}/book-access`, {
    bookId,
  });
}

async function revokeBookAccess(
  memberId: string,
  accessId: string
): Promise<void> {
  await apiClient.delete(
    `/tenant/members/${memberId}/book-access/${accessId}`
  );
}

async function updateEnrollmentValidity(
  memberId: string,
  enrollmentId: string,
  validTill: string | null
): Promise<void> {
  await apiClient.patch(
    `/tenant/members/${memberId}/enrollments/${enrollmentId}/validity`,
    { valid_till: validTill }
  );
}

async function updateBookAccessValidity(
  memberId: string,
  accessId: string,
  validTill: string | null
): Promise<void> {
  await apiClient.patch(
    `/tenant/members/${memberId}/book-access/${accessId}/validity`,
    { valid_till: validTill }
  );
}

// ─── Batch enrollments ─────────────────────────────────────────────────────

async function getMemberBatchEnrollments(
  memberId: string
): Promise<MemberBatchEnrollment[]> {
  const response = await apiClient.get<ApiResponse<MemberBatchEnrollment[]>>(
    `/tenant/members/${memberId}/batch-enrollments`
  );
  return response.data.data;
}

async function grantBatchAccess(
  memberId: string,
  batchId: string
): Promise<MemberAccessGrantAction> {
  const response = await apiClient.post<
    ApiResponse<{ action: MemberAccessGrantAction }>
  >(`/tenant/members/${memberId}/batch-enrollments`, { batchId });
  return response.data.data.action;
}

async function revokeBatchAccess(
  memberId: string,
  enrollmentId: string
): Promise<void> {
  await apiClient.delete(
    `/tenant/members/${memberId}/batch-enrollments/${enrollmentId}`
  );
}

async function updateBatchEnrollmentValidity(
  memberId: string,
  enrollmentId: string,
  validTill: string | null
): Promise<void> {
  await apiClient.patch(
    `/tenant/members/${memberId}/batch-enrollments/${enrollmentId}/validity`,
    { valid_till: validTill }
  );
}

// ─── Test series enrollments ───────────────────────────────────────────────

async function getMemberTestSeriesEnrollments(
  memberId: string
): Promise<MemberTestSeriesEnrollment[]> {
  const response = await apiClient.get<
    ApiResponse<MemberTestSeriesEnrollment[]>
  >(`/tenant/members/${memberId}/test-series-enrollments`);
  return response.data.data;
}

async function grantTestSeriesAccess(
  memberId: string,
  testSeriesId: string
): Promise<MemberAccessGrantAction> {
  const response = await apiClient.post<
    ApiResponse<{ action: MemberAccessGrantAction }>
  >(`/tenant/members/${memberId}/test-series-enrollments`, { testSeriesId });
  return response.data.data.action;
}

async function revokeTestSeriesAccess(
  memberId: string,
  enrollmentId: string
): Promise<void> {
  await apiClient.delete(
    `/tenant/members/${memberId}/test-series-enrollments/${enrollmentId}`
  );
}

async function updateTestSeriesEnrollmentValidity(
  memberId: string,
  enrollmentId: string,
  validTill: string | null
): Promise<void> {
  await apiClient.patch(
    `/tenant/members/${memberId}/test-series-enrollments/${enrollmentId}/validity`,
    { valid_till: validTill }
  );
}

// ─── Bundle access ────────────────

async function grantBundleAccess(
  memberId: string,
  bundleId: string
): Promise<MemberAccessGrantAction> {
  const response = await apiClient.post<
    ApiResponse<{ action: MemberAccessGrantAction }>
  >(`/tenant/members/${memberId}/bundle-access`, { bundleId });
  return response.data.data.action;
}

async function getPublishedCourses(): Promise<PublishedCourse[]> {
  const response = await apiClient.get<ApiResponse<PublishedCourse[]>>(
    "/tenant/members/published-courses"
  );
  return response.data.data;
}

async function getPublishedBooks(): Promise<PublishedBook[]> {
  const response = await apiClient.get<ApiResponse<PublishedBook[]>>(
    "/tenant/members/published-books"
  );
  return response.data.data;
}

async function getMemberDetailStats(
  memberId: string
): Promise<MemberDetailStats> {
  const response = await apiClient.get<ApiResponse<MemberDetailStats>>(
    `/tenant/members/${memberId}/detail-stats`
  );
  return response.data.data;
}

async function getMemberCartItems(
  memberId: string
): Promise<MemberCartItem[]> {
  const response = await apiClient.get<ApiResponse<MemberCartItem[]>>(
    `/tenant/members/${memberId}/cart-items`
  );
  return response.data.data;
}

async function getMemberCouponRedemptions(
  memberId: string
): Promise<MemberCouponRedemption[]> {
  const response = await apiClient.get<
    ApiResponse<MemberCouponRedemption[]>
  >(`/tenant/members/${memberId}/coupon-redemptions`);
  return response.data.data;
}

async function getMemberRefunds(
  memberId: string
): Promise<MemberRefund[]> {
  const response = await apiClient.get<ApiResponse<MemberRefund[]>>(
    `/tenant/members/${memberId}/refunds`
  );
  return response.data.data;
}

async function getMemberCourseAnalytics(
  memberId: string
): Promise<MemberCourseAnalyticsSummary[]> {
  const response = await apiClient.get<
    ApiResponse<MemberCourseAnalyticsSummary[]>
  >(`/tenant/members/${memberId}/course-analytics`);
  return response.data.data;
}

async function getMemberCourseAnalyticsDetail(
  memberId: string,
  courseId: string
): Promise<MemberCourseAnalyticsDetail> {
  const response = await apiClient.get<
    ApiResponse<MemberCourseAnalyticsDetail>
  >(`/tenant/members/${memberId}/course-analytics/${courseId}`);
  return response.data.data;
}

async function getMemberCourseAnalyticsExport(
  memberId: string
): Promise<MemberCourseAnalyticsExportPayload> {
  const response = await apiClient.get<
    ApiResponse<MemberCourseAnalyticsExportPayload>
  >(`/tenant/members/${memberId}/course-analytics/export`);
  return response.data.data;
}

async function syncMemberCourseAnalyticsDurations(
  memberId: string
): Promise<MemberCourseAnalyticsSyncResult> {
  const response = await apiClient.post<
    ApiResponse<MemberCourseAnalyticsSyncResult>
  >(`/tenant/members/${memberId}/course-analytics/sync-durations`);
  return response.data.data;
}

async function getMemberQuizAnalytics(
  memberId: string
): Promise<MemberQuizAnalyticsResponse> {
  const response = await apiClient.get<
    ApiResponse<MemberQuizAnalyticsResponse>
  >(`/tenant/members/${memberId}/quiz-analytics`);
  return response.data.data;
}

async function getMemberAssignmentAnalytics(
  memberId: string
): Promise<MemberAssignmentAnalyticsResponse> {
  const response = await apiClient.get<
    ApiResponse<MemberAssignmentAnalyticsResponse>
  >(`/tenant/members/${memberId}/assignment-analytics`);
  return response.data.data;
}

/**
 * Streams the rich .xlsx workbook from the server and triggers a native
 * browser download. The filename is taken from the Content-Disposition
 * header so it stays in sync with the server-side naming.
 */
async function downloadMemberCourseAnalyticsXlsx(
  memberId: string
): Promise<void> {
  const response = await apiClient.get(
    `/tenant/members/${memberId}/course-analytics/export.xlsx`,
    { responseType: "blob" }
  );
  const blob = response.data as Blob;
  const disposition = response.headers["content-disposition"] as
    | string
    | undefined;
  const match = disposition?.match(/filename="?([^"]+)"?/i);
  const fileName = match?.[1] ?? `course-analytics-${memberId}.xlsx`;
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export const membersApi = {
  listMembers,
  getMember,
  createMember,
  updateMemberStatus,
  updateMemberProfile,
  getMemberEnrollments,
  getMemberBookAccess,
  getMemberOrders,
  getMemberCertificates,
  getMemberStats,
  grantCourseAccess,
  revokeCourseAccess,
  updateEnrollmentValidity,
  grantBookAccess,
  revokeBookAccess,
  updateBookAccessValidity,
  getMemberBatchEnrollments,
  grantBatchAccess,
  revokeBatchAccess,
  updateBatchEnrollmentValidity,
  getMemberTestSeriesEnrollments,
  grantTestSeriesAccess,
  revokeTestSeriesAccess,
  updateTestSeriesEnrollmentValidity,
  grantBundleAccess,
  getPublishedCourses,
  getPublishedBooks,
  getMemberDetailStats,
  getMemberCartItems,
  getMemberCouponRedemptions,
  getMemberRefunds,
  getMemberCourseAnalytics,
  getMemberCourseAnalyticsDetail,
  getMemberCourseAnalyticsExport,
  getMemberQuizAnalytics,
  getMemberAssignmentAnalytics,
  downloadMemberCourseAnalyticsXlsx,
  syncMemberCourseAnalyticsDurations,
};
