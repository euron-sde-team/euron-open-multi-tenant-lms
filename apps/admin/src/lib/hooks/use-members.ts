import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  membersApi,
  type UpdateMemberProfileInput,
  type CreateMemberInput,
} from "../api/members";
import type { MembersListParams } from "../types/members";

export const memberKeys = {
  all: ["members"] as const,
  list: (params: MembersListParams) =>
    [...memberKeys.all, "list", params] as const,
  detail: (id: string) => [...memberKeys.all, "detail", id] as const,
  enrollments: (id: string) =>
    [...memberKeys.all, "enrollments", id] as const,
  bookAccess: (id: string) =>
    [...memberKeys.all, "book-access", id] as const,
  batchEnrollments: (id: string) =>
    [...memberKeys.all, "batch-enrollments", id] as const,
  testSeriesEnrollments: (id: string) =>
    [...memberKeys.all, "test-series-enrollments", id] as const,
  orders: (id: string) => [...memberKeys.all, "orders", id] as const,
  certificates: (id: string) =>
    [...memberKeys.all, "certificates", id] as const,
  stats: () => [...memberKeys.all, "stats"] as const,
  publishedCourses: () =>
    [...memberKeys.all, "published-courses"] as const,
  publishedBooks: () => [...memberKeys.all, "published-books"] as const,
  detailStats: (id: string) =>
    [...memberKeys.all, "detail-stats", id] as const,
  cartItems: (id: string) =>
    [...memberKeys.all, "cart-items", id] as const,
  couponRedemptions: (id: string) =>
    [...memberKeys.all, "coupon-redemptions", id] as const,
  refunds: (id: string) =>
    [...memberKeys.all, "refunds", id] as const,
  courseAnalytics: (id: string) =>
    [...memberKeys.all, "course-analytics", id] as const,
  courseAnalyticsDetail: (id: string, courseId: string) =>
    [...memberKeys.all, "course-analytics", id, "detail", courseId] as const,
  quizAnalytics: (id: string) =>
    [...memberKeys.all, "quiz-analytics", id] as const,
  assignmentAnalytics: (id: string) =>
    [...memberKeys.all, "assignment-analytics", id] as const,
};

export function useMembers(
  params: MembersListParams,
  enabled = true
) {
  return useQuery({
    queryKey: memberKeys.list(params),
    queryFn: () => membersApi.listMembers(params),
    enabled,
    placeholderData: (prev) => prev,
  });
}

export function useMember(memberId: string | undefined) {
  return useQuery({
    queryKey: memberKeys.detail(memberId ?? ""),
    queryFn: () => membersApi.getMember(memberId!),
    enabled: !!memberId,
  });
}

export function useMemberEnrollments(memberId: string | undefined) {
  return useQuery({
    queryKey: memberKeys.enrollments(memberId ?? ""),
    queryFn: () => membersApi.getMemberEnrollments(memberId!),
    enabled: !!memberId,
  });
}

export function useMemberBookAccess(memberId: string | undefined) {
  return useQuery({
    queryKey: memberKeys.bookAccess(memberId ?? ""),
    queryFn: () => membersApi.getMemberBookAccess(memberId!),
    enabled: !!memberId,
  });
}

export function useMemberBatchEnrollments(memberId: string | undefined) {
  return useQuery({
    queryKey: memberKeys.batchEnrollments(memberId ?? ""),
    queryFn: () => membersApi.getMemberBatchEnrollments(memberId!),
    enabled: !!memberId,
  });
}

export function useMemberTestSeriesEnrollments(memberId: string | undefined) {
  return useQuery({
    queryKey: memberKeys.testSeriesEnrollments(memberId ?? ""),
    queryFn: () => membersApi.getMemberTestSeriesEnrollments(memberId!),
    enabled: !!memberId,
  });
}

export function useMemberOrders(memberId: string | undefined) {
  return useQuery({
    queryKey: memberKeys.orders(memberId ?? ""),
    queryFn: () => membersApi.getMemberOrders(memberId!),
    enabled: !!memberId,
  });
}

export function useMemberCertificates(memberId: string | undefined) {
  return useQuery({
    queryKey: memberKeys.certificates(memberId ?? ""),
    queryFn: () => membersApi.getMemberCertificates(memberId!),
    enabled: !!memberId,
  });
}

export function useMemberStats(enabled = true) {
  return useQuery({
    queryKey: memberKeys.stats(),
    queryFn: () => membersApi.getMemberStats(),
    enabled,
  });
}

export function usePublishedCourses(enabled = true) {
  return useQuery({
    queryKey: memberKeys.publishedCourses(),
    queryFn: () => membersApi.getPublishedCourses(),
    enabled,
  });
}

export function usePublishedBooks(enabled = true) {
  return useQuery({
    queryKey: memberKeys.publishedBooks(),
    queryFn: () => membersApi.getPublishedBooks(),
    enabled,
  });
}

export function useUpdateMemberStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      memberId,
      status,
    }: {
      memberId: string;
      status: string;
    }) => membersApi.updateMemberStatus(memberId, status),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: memberKeys.all });
    },
  });
}

export function useCreateMember() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateMemberInput) => membersApi.createMember(input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: memberKeys.all });
    },
  });
}

export function useUpdateMemberProfile() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      memberId,
      input,
    }: {
      memberId: string;
      input: UpdateMemberProfileInput;
    }) => membersApi.updateMemberProfile(memberId, input),
    onSuccess: (updated, vars) => {
      qc.setQueryData(memberKeys.detail(vars.memberId), updated);
      qc.invalidateQueries({
        queryKey: [...memberKeys.all, "list"],
      });
    },
  });
}

export function useGrantCourseAccess() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      memberId,
      courseId,
    }: {
      memberId: string;
      courseId: string;
    }) => membersApi.grantCourseAccess(memberId, courseId),
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({
        queryKey: memberKeys.enrollments(vars.memberId),
      });
      qc.invalidateQueries({ queryKey: memberKeys.list({}) });
    },
  });
}

export function useRevokeCourseAccess() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      memberId,
      enrollmentId,
    }: {
      memberId: string;
      enrollmentId: string;
    }) => membersApi.revokeCourseAccess(memberId, enrollmentId),
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({
        queryKey: memberKeys.enrollments(vars.memberId),
      });
      qc.invalidateQueries({ queryKey: memberKeys.list({}) });
    },
  });
}

export function useGrantBookAccess() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      memberId,
      bookId,
    }: {
      memberId: string;
      bookId: string;
    }) => membersApi.grantBookAccess(memberId, bookId),
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({
        queryKey: memberKeys.bookAccess(vars.memberId),
      });
      qc.invalidateQueries({ queryKey: memberKeys.list({}) });
    },
  });
}

export function useRevokeBookAccess() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      memberId,
      accessId,
    }: {
      memberId: string;
      accessId: string;
    }) => membersApi.revokeBookAccess(memberId, accessId),
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({
        queryKey: memberKeys.bookAccess(vars.memberId),
      });
      qc.invalidateQueries({ queryKey: memberKeys.list({}) });
    },
  });
}

export function useUpdateEnrollmentValidity() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      memberId,
      enrollmentId,
      validTill,
    }: {
      memberId: string;
      enrollmentId: string;
      validTill: string | null;
    }) =>
      membersApi.updateEnrollmentValidity(memberId, enrollmentId, validTill),
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({
        queryKey: memberKeys.enrollments(vars.memberId),
      });
    },
  });
}

export function useUpdateBookAccessValidity() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      memberId,
      accessId,
      validTill,
    }: {
      memberId: string;
      accessId: string;
      validTill: string | null;
    }) => membersApi.updateBookAccessValidity(memberId, accessId, validTill),
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({
        queryKey: memberKeys.bookAccess(vars.memberId),
      });
    },
  });
}

export function useGrantBatchAccess() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      memberId,
      batchId,
    }: {
      memberId: string;
      batchId: string;
    }) => membersApi.grantBatchAccess(memberId, batchId),
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({
        queryKey: memberKeys.batchEnrollments(vars.memberId),
      });
      qc.invalidateQueries({ queryKey: memberKeys.list({}) });
    },
  });
}

export function useRevokeBatchAccess() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      memberId,
      enrollmentId,
    }: {
      memberId: string;
      enrollmentId: string;
    }) => membersApi.revokeBatchAccess(memberId, enrollmentId),
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({
        queryKey: memberKeys.batchEnrollments(vars.memberId),
      });
      qc.invalidateQueries({ queryKey: memberKeys.list({}) });
    },
  });
}

export function useUpdateBatchEnrollmentValidity() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      memberId,
      enrollmentId,
      validTill,
    }: {
      memberId: string;
      enrollmentId: string;
      validTill: string | null;
    }) =>
      membersApi.updateBatchEnrollmentValidity(
        memberId,
        enrollmentId,
        validTill
      ),
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({
        queryKey: memberKeys.batchEnrollments(vars.memberId),
      });
    },
  });
}

export function useGrantTestSeriesAccess() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      memberId,
      testSeriesId,
    }: {
      memberId: string;
      testSeriesId: string;
    }) => membersApi.grantTestSeriesAccess(memberId, testSeriesId),
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({
        queryKey: memberKeys.testSeriesEnrollments(vars.memberId),
      });
      qc.invalidateQueries({ queryKey: memberKeys.list({}) });
    },
  });
}

export function useRevokeTestSeriesAccess() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      memberId,
      enrollmentId,
    }: {
      memberId: string;
      enrollmentId: string;
    }) => membersApi.revokeTestSeriesAccess(memberId, enrollmentId),
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({
        queryKey: memberKeys.testSeriesEnrollments(vars.memberId),
      });
      qc.invalidateQueries({ queryKey: memberKeys.list({}) });
    },
  });
}

export function useUpdateTestSeriesEnrollmentValidity() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      memberId,
      enrollmentId,
      validTill,
    }: {
      memberId: string;
      enrollmentId: string;
      validTill: string | null;
    }) =>
      membersApi.updateTestSeriesEnrollmentValidity(
        memberId,
        enrollmentId,
        validTill
      ),
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({
        queryKey: memberKeys.testSeriesEnrollments(vars.memberId),
      });
    },
  });
}

/**
 * Grant a bundle to a member. The grant fans out to the bundle's children,
 * so the course / book / test-series lists are all invalidated.
 */
export function useGrantBundleAccess() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      memberId,
      bundleId,
    }: {
      memberId: string;
      bundleId: string;
    }) => membersApi.grantBundleAccess(memberId, bundleId),
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({
        queryKey: memberKeys.enrollments(vars.memberId),
      });
      qc.invalidateQueries({
        queryKey: memberKeys.bookAccess(vars.memberId),
      });
      qc.invalidateQueries({
        queryKey: memberKeys.testSeriesEnrollments(vars.memberId),
      });
      qc.invalidateQueries({ queryKey: memberKeys.list({}) });
    },
  });
}

export function useMemberDetailStats(
  memberId: string | undefined,
  enabled = true
) {
  return useQuery({
    queryKey: memberKeys.detailStats(memberId ?? ""),
    queryFn: () => membersApi.getMemberDetailStats(memberId!),
    enabled: !!memberId && enabled,
  });
}

export function useMemberCartItems(
  memberId: string | undefined,
  enabled = true
) {
  return useQuery({
    queryKey: memberKeys.cartItems(memberId ?? ""),
    queryFn: () => membersApi.getMemberCartItems(memberId!),
    enabled: !!memberId && enabled,
  });
}

export function useMemberCouponRedemptions(
  memberId: string | undefined,
  enabled = true
) {
  return useQuery({
    queryKey: memberKeys.couponRedemptions(memberId ?? ""),
    queryFn: () => membersApi.getMemberCouponRedemptions(memberId!),
    enabled: !!memberId && enabled,
  });
}

export function useMemberRefunds(
  memberId: string | undefined,
  enabled = true
) {
  return useQuery({
    queryKey: memberKeys.refunds(memberId ?? ""),
    queryFn: () => membersApi.getMemberRefunds(memberId!),
    enabled: !!memberId && enabled,
  });
}

export function useMemberCourseAnalytics(
  memberId: string | undefined,
  enabled = true
) {
  return useQuery({
    queryKey: memberKeys.courseAnalytics(memberId ?? ""),
    queryFn: () => membersApi.getMemberCourseAnalytics(memberId!),
    enabled: !!memberId && enabled,
  });
}

export function useMemberCourseAnalyticsDetail(
  memberId: string | undefined,
  courseId: string | undefined,
  enabled = true
) {
  return useQuery({
    queryKey: memberKeys.courseAnalyticsDetail(memberId ?? "", courseId ?? ""),
    queryFn: () =>
      membersApi.getMemberCourseAnalyticsDetail(memberId!, courseId!),
    enabled: !!memberId && !!courseId && enabled,
  });
}

export function useMemberQuizAnalytics(
  memberId: string | undefined,
  enabled = true
) {
  return useQuery({
    queryKey: memberKeys.quizAnalytics(memberId ?? ""),
    queryFn: () => membersApi.getMemberQuizAnalytics(memberId!),
    enabled: !!memberId && enabled,
  });
}

export function useMemberAssignmentAnalytics(
  memberId: string | undefined,
  enabled = true
) {
  return useQuery({
    queryKey: memberKeys.assignmentAnalytics(memberId ?? ""),
    queryFn: () => membersApi.getMemberAssignmentAnalytics(memberId!),
    enabled: !!memberId && enabled,
  });
}

export function useSyncMemberCourseAnalyticsDurations() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ memberId }: { memberId: string }) =>
      membersApi.syncMemberCourseAnalyticsDurations(memberId),
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({
        queryKey: memberKeys.courseAnalytics(vars.memberId),
      });
      qc.invalidateQueries({
        queryKey: [...memberKeys.all, "course-analytics", vars.memberId],
      });
    },
  });
}
