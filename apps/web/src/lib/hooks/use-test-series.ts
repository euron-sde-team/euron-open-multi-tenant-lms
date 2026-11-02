import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  fetchTestSeriesCatalog,
  fetchTestSeriesDetail,
  testSeriesClientApi,
  type AttemptState,
  type CatalogSeries,
  type MyEnrollment,
  type ResultPayload,
  type SeriesDetail,
  type SubmitResult,
  type TestAttemptSummary,
} from "@/lib/api/test-series";
import { useUserAuthStore } from "@/lib/stores/auth-store";

export const testSeriesKeys = {
  all: ["test-series"] as const,
  catalog: (params?: unknown) => [...testSeriesKeys.all, "catalog", params ?? {}] as const,
  detail: (slug: string) => [...testSeriesKeys.all, "detail", slug] as const,
  myEnrollments: () => [...testSeriesKeys.all, "my-enrollments"] as const,
  attempt: (attemptId: string) => [...testSeriesKeys.all, "attempt", attemptId] as const,
  result: (attemptId: string) => [...testSeriesKeys.all, "result", attemptId] as const,
  attemptsByTest: (testId: string) =>
    [...testSeriesKeys.all, "attempts-by-test", testId] as const,
};

export function useTestSeriesCatalog(params?: {
  search?: string;
  category?: string;
  pricing?: string;
}) {
  return useQuery<CatalogSeries[]>({
    queryKey: testSeriesKeys.catalog(params),
    queryFn: () => fetchTestSeriesCatalog(params),
  });
}

export function useTestSeriesDetail(slug: string | undefined) {
  return useQuery<SeriesDetail | null>({
    queryKey: testSeriesKeys.detail(slug ?? ""),
    queryFn: () => fetchTestSeriesDetail(slug!),
    enabled: !!slug,
  });
}

export function useMyTestSeriesEnrollments() {
  const { isAuthenticated } = useUserAuthStore();
  return useQuery<MyEnrollment[]>({
    queryKey: testSeriesKeys.myEnrollments(),
    queryFn: () => testSeriesClientApi.myEnrollments(),
    enabled: isAuthenticated,
  });
}

export function useStartTestAttempt() {
  const qc = useQueryClient();
  return useMutation<AttemptState, Error, { testId: string; seriesId: string }>({
    mutationFn: ({ testId, seriesId }) =>
      testSeriesClientApi.startAttempt(testId, seriesId),
    onSuccess: (data) => {
      qc.setQueryData(testSeriesKeys.attempt(data.attemptId), data);
    },
  });
}

export function useTestAttempt(attemptId: string | undefined) {
  return useQuery<AttemptState>({
    queryKey: testSeriesKeys.attempt(attemptId ?? ""),
    queryFn: () => testSeriesClientApi.getAttempt(attemptId!),
    enabled: !!attemptId,
    // Don't refetch on focus, we have the canonical state in the Zustand store during the attempt
    refetchOnWindowFocus: false,
    staleTime: Infinity,
  });
}

export function useSubmitTestAttempt() {
  const qc = useQueryClient();
  return useMutation<
    SubmitResult,
    Error,
    { attemptId: string; tabSwitchCount?: number }
  >({
    mutationFn: ({ attemptId, tabSwitchCount }) =>
      testSeriesClientApi.submitAttempt(attemptId, tabSwitchCount),
    onSuccess: (_data, { attemptId }) => {
      qc.invalidateQueries({ queryKey: testSeriesKeys.attempt(attemptId) });
      qc.invalidateQueries({ queryKey: testSeriesKeys.result(attemptId) });
    },
  });
}

export function useTestResult(attemptId: string | undefined) {
  return useQuery<ResultPayload>({
    queryKey: testSeriesKeys.result(attemptId ?? ""),
    queryFn: () => testSeriesClientApi.getResult(attemptId!),
    enabled: !!attemptId,
  });
}

/** A learner's full attempt history for a test (re-attempt analytics). */
export function useTestAttempts(testId: string | undefined) {
  return useQuery<TestAttemptSummary[]>({
    queryKey: testSeriesKeys.attemptsByTest(testId ?? ""),
    queryFn: () => testSeriesClientApi.listAttempts(testId!),
    enabled: !!testId,
  });
}
