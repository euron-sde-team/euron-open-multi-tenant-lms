import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
  type QueryClient,
} from "@tanstack/react-query";

import {
  testAIApi,
  testHealthApi,
  testModulesApi,
  testQuestionBanksApi,
  testQuestionsApi,
  testGradingApi,
  testRankCurvesApi,
  testsApi,
  testSeriesApi,
  testSeriesAIApi,
  testTaxonomyApi,
  type TaxonomyKind,
  type BlueprintRule,
  type AIGenerateConfig,
  type AIJobStatusResponse,
  type CreateModulePayload,
  type CreateQuestionPayload,
  type CreateRankCurvePayload,
  type CreateSeriesPayload,
  type CreateTestPayload,
  type CreateTestFullPayload,
  type RandomPickPayload,
  type Test,
  type TestFullTree,
  type TestQuestion,
  type TestQuestionStatus,
  type TestSeries,
  type TestSeriesEntitlementUsage,
  type TestSeriesPricingType,
  type TestSeriesVisibility,
  type TestSeriesAIInput,
  type TestSeriesAIJobStatus,
  type TestStatus,
  type TestNormTablePoint,
} from "../api/test-series";

import { entitlementKeys } from "./use-entitlements";

// ---------- Query keys ----------
export const testSeriesKeys = {
  all: ["test-series"] as const,
  banks: {
    all: ["test-series", "banks"] as const,
    list: (params?: unknown) =>
      [...testSeriesKeys.banks.all, "list", params ?? {}] as const,
    detail: (bankId: string) =>
      [...testSeriesKeys.banks.all, "detail", bankId] as const,
  },
  questions: {
    all: ["test-series", "questions"] as const,
    list: (params?: unknown) =>
      [...testSeriesKeys.questions.all, "list", params ?? {}] as const,
    detail: (questionId: string) =>
      [...testSeriesKeys.questions.all, "detail", questionId] as const,
    byIds: (ids: string[]) =>
      [...testSeriesKeys.questions.all, "by-ids", ids.slice().sort()] as const,
  },
  tests: {
    all: ["test-series", "tests"] as const,
    list: (params?: unknown) =>
      [...testSeriesKeys.tests.all, "list", params ?? {}] as const,
    detail: (testId: string) =>
      [...testSeriesKeys.tests.all, "detail", testId] as const,
    full: (testId: string) =>
      [...testSeriesKeys.tests.all, "full", testId] as const,
    sections: (testId: string) =>
      [...testSeriesKeys.tests.all, "sections", testId] as const,
    modules: (testId: string) =>
      [...testSeriesKeys.tests.all, "modules", testId] as const,
    attemptReview: (attemptId: string) =>
      [...testSeriesKeys.tests.all, "attempt-review", attemptId] as const,
    learners: (params?: unknown) =>
      [...testSeriesKeys.tests.all, "learners", params ?? {}] as const,
    learnerAttempts: (learnerId: string) =>
      [...testSeriesKeys.tests.all, "learner-attempts", learnerId] as const,
  },
  series: {
    all: ["test-series", "series"] as const,
    list: (params?: unknown) =>
      [...testSeriesKeys.series.all, "list", params ?? {}] as const,
    detail: (seriesId: string) =>
      [...testSeriesKeys.series.all, "detail", seriesId] as const,
    tests: (seriesId: string) =>
      [...testSeriesKeys.series.all, "tests", seriesId] as const,
    entitlementUsage: () =>
      [...testSeriesKeys.series.all, "entitlement-usage"] as const,
  },
  ai: {
    all: ["test-series", "ai"] as const,
    status: (jobId: string) => [...["test-series", "ai", "status", jobId]] as const,
  },
  grading: {
    all: ["test-series", "grading"] as const,
    pending: (params?: unknown) =>
      [...["test-series", "grading", "pending", params ?? {}]] as const,
    attempt: (attemptId: string) =>
      [...["test-series", "grading", "attempt", attemptId]] as const,
  },
  taxonomy: {
    all: ["test-series", "taxonomy"] as const,
    list: (kind?: string, parentId?: string) =>
      [...["test-series", "taxonomy", "list", kind ?? "", parentId ?? ""]] as const,
  },
};

// ---------- Optimistic cache helpers ----------
//
// Pattern (mirrors apps/web use-community.ts): cancel in-flight queries,
// patch every affected cache immediately, keep an undo() that restores the
// exact snapshots for onError, and reconverge with the server via the usual
// invalidations in onSettled. The click feels instant; the server stays the
// source of truth.

/**
 * Patch every cached list under `rootKey` whose payload holds an array at
 * `listField`. `patch` returns the replacement item or null to drop the row
 * (`total` is kept in sync). Returns an undo() restoring the snapshots.
 */
function patchListCaches<T extends { id: string }>(
  qc: QueryClient,
  rootKey: readonly unknown[],
  listField: string,
  patch: (item: T) => T | null
): () => void {
  const snapshots = qc.getQueriesData<Record<string, unknown>>({
    queryKey: rootKey,
  });
  for (const [key, data] of snapshots) {
    if (!data) continue;
    const list = data[listField];
    if (!Array.isArray(list)) continue;
    const next: T[] = [];
    for (const item of list as T[]) {
      const patched = patch(item);
      if (patched !== null) next.push(patched);
    }
    const removed = (list as T[]).length - next.length;
    qc.setQueryData(key, {
      ...data,
      [listField]: next,
      ...(typeof data.total === "number"
        ? { total: Math.max(0, (data.total as number) - removed) }
        : {}),
    });
  }
  return () => {
    for (const [key, data] of snapshots) qc.setQueryData(key, data);
  };
}

/** Patch a single object cache; returns undo(). No-op when not cached. */
function patchObjectCache<T>(
  qc: QueryClient,
  key: readonly unknown[],
  patch: (data: T) => T
): () => void {
  const prev = qc.getQueryData<T>(key);
  if (prev !== undefined) qc.setQueryData(key, patch(prev));
  return () => {
    if (prev !== undefined) qc.setQueryData(key, prev);
  };
}

/** Bump the live testseries_count usage badge; returns undo(). */
function patchEntitlementUsage(qc: QueryClient, delta: number): () => void {
  return patchObjectCache<TestSeriesEntitlementUsage>(
    qc,
    testSeriesKeys.series.entitlementUsage(),
    (prev) => {
      if (prev.isUnlimited) return prev;
      const used = Math.max(0, prev.used + delta);
      return { ...prev, used, atCapacity: prev.limit > 0 && used >= prev.limit };
    }
  );
}

/** Flip a test's status across list, detail and full-tree caches. */
function patchTestStatus(
  qc: QueryClient,
  testId: string,
  status: TestStatus
): () => void {
  const undos = [
    patchListCaches<Test>(qc, testSeriesKeys.tests.all, "tests", (t) =>
      t.id === testId ? { ...t, status } : t
    ),
    patchObjectCache<Test>(qc, testSeriesKeys.tests.detail(testId), (t) => ({
      ...t,
      status,
    })),
    patchObjectCache<TestFullTree>(qc, testSeriesKeys.tests.full(testId), (tree) => ({
      ...tree,
      test: { ...tree.test, status },
    })),
  ];
  return () => undos.forEach((u) => u());
}

/** Flip a series' status across list + detail caches (+ usage badge). */
function patchSeriesStatus(
  qc: QueryClient,
  seriesId: string,
  status: TestStatus,
  usageDelta: number
): () => void {
  const undos = [
    patchListCaches<TestSeries>(qc, testSeriesKeys.series.all, "series", (s) =>
      s.id === seriesId ? { ...s, status } : s
    ),
    patchObjectCache<TestSeries>(qc, testSeriesKeys.series.detail(seriesId), (s) => ({
      ...s,
      status,
    })),
    patchEntitlementUsage(qc, usageDelta),
  ];
  return () => undos.forEach((u) => u());
}

// ---------- AI generation ----------
export const useSubmitTestAIGeneration = () => {
  return useMutation<
    { jobId: string },
    Error,
    { bankId: string; file: File; config: AIGenerateConfig }
  >({
    mutationFn: ({ bankId, file, config }) =>
      testAIApi.submitGeneration(bankId, file, config),
  });
};

export const useTestAIJobStatus = (
  jobId: string | null,
  options?: { enabled?: boolean; pollIntervalMs?: number }
) => {
  return useQuery<AIJobStatusResponse>({
    queryKey: testSeriesKeys.ai.status(jobId ?? ""),
    queryFn: () => testAIApi.getStatus(jobId!),
    enabled: !!jobId && (options?.enabled ?? true),
    refetchInterval: (query) => {
      const data = query.state.data;
      if (!data) return options?.pollIntervalMs ?? 2000;
      // Stop polling once terminal
      if (
        data.state === "completed" ||
        data.state === "failed" ||
        data.state === "not_found"
      )
        return false;
      return options?.pollIntervalMs ?? 2000;
    },
    refetchOnWindowFocus: false,
  });
};

// ---------- Test-series metadata AI (title / description / cover) ----------
export const useSubmitTestSeriesAI = () => {
  return useMutation({
    mutationFn: (input: TestSeriesAIInput) => testSeriesAIApi.submit(input),
  });
};

export const useTestSeriesAIJobStatus = (
  jobId: string | null,
  options?: { enabled?: boolean; pollIntervalMs?: number }
) => {
  return useQuery<TestSeriesAIJobStatus>({
    queryKey: ["test-series", "ai", "metadata-status", jobId ?? ""],
    queryFn: () => testSeriesAIApi.getStatus(jobId!),
    enabled: !!jobId && (options?.enabled ?? true),
    refetchInterval: (query) => {
      const data = query.state.data;
      if (!data) return options?.pollIntervalMs ?? 1500;
      if (
        data.state === "completed" ||
        data.state === "failed" ||
        data.state === "not_found"
      )
        return false;
      return options?.pollIntervalMs ?? 1500;
    },
    refetchOnWindowFocus: false,
  });
};

// ---------- Question Banks ----------
export const useTestQuestionBanks = (params?: {
  page?: number;
  limit?: number;
  search?: string;
}) => {
  return useQuery({
    queryKey: testSeriesKeys.banks.list(params),
    queryFn: () => testQuestionBanksApi.list(params),
  });
};

export const useTestQuestionBank = (bankId: string | undefined) => {
  return useQuery({
    queryKey: testSeriesKeys.banks.detail(bankId ?? ""),
    queryFn: () => testQuestionBanksApi.get(bankId!),
    enabled: !!bankId,
  });
};

export const useCreateTestQuestionBank = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { name: string; description?: string | null }) =>
      testQuestionBanksApi.create(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: testSeriesKeys.banks.all });
    },
  });
};

export const useUpdateTestQuestionBank = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      bankId,
      data,
    }: {
      bankId: string;
      data: { name?: string; description?: string | null };
    }) => testQuestionBanksApi.update(bankId, data),
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: testSeriesKeys.banks.all });
      qc.invalidateQueries({ queryKey: testSeriesKeys.banks.detail(vars.bankId) });
    },
  });
};

export const useDeleteTestQuestionBank = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (bankId: string) => testQuestionBanksApi.delete(bankId),
    onMutate: async (bankId) => {
      await qc.cancelQueries({ queryKey: testSeriesKeys.banks.all });
      return {
        undo: patchListCaches<{ id: string }>(
          qc,
          testSeriesKeys.banks.all,
          "banks",
          (b) => (b.id === bankId ? null : b)
        ),
      };
    },
    onError: (_err, _bankId, ctx) => ctx?.undo(),
    onSettled: () => {
      qc.invalidateQueries({ queryKey: testSeriesKeys.banks.all });
    },
  });
};

// ---------- Questions ----------
export const useTestQuestions = (params: {
  question_bank_id?: string;
  page?: number;
  limit?: number;
  search?: string;
  type?: CreateQuestionPayload["type"];
  difficulty?: CreateQuestionPayload["difficulty"];
  status?: TestQuestionStatus;
  subject?: string;
  chapter?: string;
  topic?: string;
  subject_node_id?: string;
  chapter_node_id?: string;
  topic_node_id?: string;
  created_via?: CreateQuestionPayload["created_via"];
}) => {
  return useQuery({
    queryKey: testSeriesKeys.questions.list(params),
    queryFn: () => testQuestionsApi.list(params),
    // Keep the current rows visible while a filter/search refetches, so changing
    // a filter does not flash an empty spinner.
    placeholderData: keepPreviousData,
  });
};

export const useTestQuestion = (questionId: string | undefined) => {
  return useQuery({
    queryKey: testSeriesKeys.questions.detail(questionId ?? ""),
    queryFn: () => testQuestionsApi.get(questionId!),
    enabled: !!questionId,
  });
};

export const useCreateTestQuestion = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateQuestionPayload) => testQuestionsApi.create(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: testSeriesKeys.questions.all });
      qc.invalidateQueries({ queryKey: entitlementKeys.all });
    },
  });
};

export const useBulkImportQuestions = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      bankId,
      questions,
    }: {
      bankId: string;
      questions: Omit<CreateQuestionPayload, "question_bank_id">[];
    }) => testQuestionsApi.bulkImport(bankId, questions),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: testSeriesKeys.questions.all });
      qc.invalidateQueries({ queryKey: entitlementKeys.all });
    },
  });
};

/** Random pick is read-only (nothing is written), so no cache invalidation. */
export const useRandomPickQuestions = () => {
  return useMutation({
    mutationFn: (data: RandomPickPayload) => testQuestionsApi.randomPick(data),
  });
};

export const useUpdateTestQuestion = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      questionId,
      data,
    }: {
      questionId: string;
      data: Partial<CreateQuestionPayload>;
    }) => testQuestionsApi.update(questionId, data),
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: testSeriesKeys.questions.all });
      qc.invalidateQueries({
        queryKey: testSeriesKeys.questions.detail(vars.questionId),
      });
    },
  });
};

export const useDeleteTestQuestion = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (questionId: string) => testQuestionsApi.delete(questionId),
    onMutate: async (questionId) => {
      await qc.cancelQueries({ queryKey: testSeriesKeys.questions.all });
      return {
        undo: patchListCaches<TestQuestion>(
          qc,
          testSeriesKeys.questions.all,
          "questions",
          (q) => (q.id === questionId ? null : q)
        ),
      };
    },
    onError: (_err, _questionId, ctx) => ctx?.undo(),
    onSettled: () => {
      qc.invalidateQueries({ queryKey: testSeriesKeys.questions.all });
      qc.invalidateQueries({ queryKey: entitlementKeys.all });
    },
  });
};

export const useBulkUpdateQuestionStatus = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      questionIds,
      status,
    }: {
      questionIds: string[];
      status: TestQuestionStatus;
    }) => testQuestionsApi.bulkUpdateStatus(questionIds, status),
    onMutate: async ({ questionIds, status }) => {
      await qc.cancelQueries({ queryKey: testSeriesKeys.questions.all });
      const ids = new Set(questionIds);
      return {
        undo: patchListCaches<TestQuestion>(
          qc,
          testSeriesKeys.questions.all,
          "questions",
          (q) => (ids.has(q.id) ? { ...q, status } : q)
        ),
      };
    },
    onError: (_err, _vars, ctx) => ctx?.undo(),
    onSettled: () => {
      qc.invalidateQueries({ queryKey: testSeriesKeys.questions.all });
    },
  });
};

// ---------- Tests ----------
export const useTests = (params?: {
  page?: number;
  limit?: number;
  status?: TestStatus;
  search?: string;
}) => {
  return useQuery({
    queryKey: testSeriesKeys.tests.list(params),
    queryFn: () => testsApi.list(params),
  });
};

export const useTest = (testId: string | undefined) => {
  return useQuery({
    queryKey: testSeriesKeys.tests.detail(testId ?? ""),
    queryFn: () => testsApi.get(testId!),
    enabled: !!testId,
  });
};

export const useTestFull = (testId: string | undefined) => {
  return useQuery({
    queryKey: testSeriesKeys.tests.full(testId ?? ""),
    queryFn: () => testsApi.getFull(testId!),
    enabled: !!testId,
  });
};

export const useCreateTest = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateTestPayload) => testsApi.create(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: testSeriesKeys.tests.all });
    },
  });
};

export const useCreateTestFull = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateTestFullPayload) => testsApi.createFull(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: testSeriesKeys.tests.all });
    },
  });
};

export const useUpdateTest = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      testId,
      data,
    }: {
      testId: string;
      data: Partial<CreateTestPayload> & { status?: TestStatus };
    }) => testsApi.update(testId, data),
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: testSeriesKeys.tests.all });
      qc.invalidateQueries({ queryKey: testSeriesKeys.tests.detail(vars.testId) });
      qc.invalidateQueries({ queryKey: testSeriesKeys.tests.full(vars.testId) });
    },
  });
};

export const useDeleteTest = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (testId: string) => testsApi.delete(testId),
    onMutate: async (testId) => {
      await qc.cancelQueries({ queryKey: testSeriesKeys.tests.all });
      return {
        undo: patchListCaches<Test>(qc, testSeriesKeys.tests.all, "tests", (t) =>
          t.id === testId ? null : t
        ),
      };
    },
    onError: (_err, _testId, ctx) => ctx?.undo(),
    onSettled: () => {
      qc.invalidateQueries({ queryKey: testSeriesKeys.tests.all });
    },
  });
};

export const usePublishTest = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (testId: string) => testsApi.publish(testId),
    onMutate: async (testId) => {
      await qc.cancelQueries({ queryKey: testSeriesKeys.tests.all });
      return { undo: patchTestStatus(qc, testId, "PUBLISHED") };
    },
    onError: (_err, _testId, ctx) => ctx?.undo(),
    onSettled: (_data, _err, testId) => {
      qc.invalidateQueries({ queryKey: testSeriesKeys.tests.all });
      qc.invalidateQueries({ queryKey: testSeriesKeys.tests.detail(testId) });
    },
  });
};

export const useUnpublishTest = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (testId: string) => testsApi.unpublish(testId),
    onMutate: async (testId) => {
      await qc.cancelQueries({ queryKey: testSeriesKeys.tests.all });
      return { undo: patchTestStatus(qc, testId, "DRAFT") };
    },
    onError: (_err, _testId, ctx) => ctx?.undo(),
    onSettled: (_data, _err, testId) => {
      qc.invalidateQueries({ queryKey: testSeriesKeys.tests.all });
      qc.invalidateQueries({ queryKey: testSeriesKeys.tests.detail(testId) });
    },
  });
};

// ---------- Adaptive modules ----------
export const useTestModules = (testId: string | undefined) => {
  return useQuery({
    queryKey: testSeriesKeys.tests.modules(testId ?? ""),
    queryFn: () => testModulesApi.list(testId!),
    enabled: !!testId,
  });
};

export const useCreateTestModule = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      testId,
      sectionId,
      data,
    }: {
      testId: string;
      sectionId: string;
      data: CreateModulePayload;
    }) => testModulesApi.create(testId, sectionId, data),
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: testSeriesKeys.tests.modules(vars.testId) });
    },
  });
};

export const useUpdateTestModule = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      testId,
      moduleId,
      data,
    }: {
      testId: string;
      moduleId: string;
      data: Partial<Omit<CreateModulePayload, "stage_no" | "variant">>;
    }) => testModulesApi.update(testId, moduleId, data),
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: testSeriesKeys.tests.modules(vars.testId) });
    },
  });
};

export const useDeleteTestModule = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ testId, moduleId }: { testId: string; moduleId: string }) =>
      testModulesApi.remove(testId, moduleId),
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: testSeriesKeys.tests.modules(vars.testId) });
    },
  });
};

export const useAddModuleQuestions = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      testId,
      moduleId,
      items,
    }: {
      testId: string;
      moduleId: string;
      items: Array<{ question_id: string; is_pretest?: boolean; order_index?: number }>;
    }) => testModulesApi.addQuestions(testId, moduleId, items),
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: testSeriesKeys.tests.modules(vars.testId) });
    },
  });
};

export const useUpdateModuleQuestion = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      testId,
      moduleId,
      questionId,
      data,
    }: {
      testId: string;
      moduleId: string;
      questionId: string;
      data: { is_pretest?: boolean; order_index?: number };
    }) => testModulesApi.updateQuestion(testId, moduleId, questionId, data),
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: testSeriesKeys.tests.modules(vars.testId) });
    },
  });
};

export const useRemoveModuleQuestion = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      testId,
      moduleId,
      questionId,
    }: {
      testId: string;
      moduleId: string;
      questionId: string;
    }) => testModulesApi.removeQuestion(testId, moduleId, questionId),
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: testSeriesKeys.tests.modules(vars.testId) });
    },
  });
};

export const useSaveScoreScales = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      testId,
      sectionId,
      scales,
    }: {
      testId: string;
      sectionId: string;
      scales: Array<{ path_key: string; scale: number[]; scale_max: number }>;
    }) => testModulesApi.saveScoreScales(testId, sectionId, scales),
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: testSeriesKeys.tests.modules(vars.testId) });
    },
  });
};

export const useAutoGenerateScoreScales = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      testId,
      sectionId,
      scaleMax,
    }: {
      testId: string;
      sectionId: string;
      scaleMax: number;
    }) => testModulesApi.autoGenerateScoreScales(testId, sectionId, scaleMax),
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: testSeriesKeys.tests.modules(vars.testId) });
    },
  });
};

export const useSaveNormTable = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      testId,
      points,
      maxScore,
    }: {
      testId: string;
      points: TestNormTablePoint[] | null;
      maxScore: number;
    }) => testModulesApi.saveNormTable(testId, points, maxScore),
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: testSeriesKeys.tests.modules(vars.testId) });
    },
  });
};

export const useAutoGenerateNormTable = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ testId, maxScore }: { testId: string; maxScore: number }) =>
      testModulesApi.autoGenerateNormTable(testId, maxScore),
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: testSeriesKeys.tests.modules(vars.testId) });
    },
  });
};

// ---------- Health analytics ----------
export const useAdaptiveHealth = (
  testId: string | undefined,
  options?: { enabled?: boolean }
) => {
  return useQuery({
    queryKey: [...testSeriesKeys.tests.all, "adaptive-health", testId ?? ""],
    queryFn: () => testHealthApi.adaptiveHealth(testId!),
    enabled: !!testId && (options?.enabled ?? true),
  });
};

export const useQuestionHealth = (
  bankId: string | undefined,
  params?: { page?: number; limit?: number },
  options?: { enabled?: boolean }
) => {
  return useQuery({
    queryKey: [
      ...testSeriesKeys.banks.all,
      "question-health",
      bankId ?? "",
      params ?? {},
    ],
    queryFn: () => testHealthApi.questionHealth(bankId!, params),
    enabled: !!bankId && (options?.enabled ?? true),
    placeholderData: keepPreviousData,
  });
};

// ---------- Series ----------
export const useTestSeriesList = (params?: {
  page?: number;
  limit?: number;
  status?: TestStatus;
  visibility?: TestSeriesVisibility;
  pricing_type?: TestSeriesPricingType;
  search?: string;
}) => {
  return useQuery({
    queryKey: testSeriesKeys.series.list(params),
    queryFn: () => testSeriesApi.list(params),
  });
};

export const useTestSeries = (seriesId: string | undefined) => {
  return useQuery({
    queryKey: testSeriesKeys.series.detail(seriesId ?? ""),
    queryFn: () => testSeriesApi.get(seriesId!),
    enabled: !!seriesId,
  });
};

export const useCreateTestSeries = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateSeriesPayload) => testSeriesApi.create(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: testSeriesKeys.series.all });
    },
  });
};

export const useUpdateTestSeries = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      seriesId,
      data,
    }: {
      seriesId: string;
      data: Partial<CreateSeriesPayload> & { status?: TestStatus };
    }) => testSeriesApi.update(seriesId, data),
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: testSeriesKeys.series.all });
      qc.invalidateQueries({
        queryKey: testSeriesKeys.series.detail(vars.seriesId),
      });
    },
  });
};

export const useDeleteTestSeries = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (seriesId: string) => testSeriesApi.delete(seriesId),
    onMutate: async (seriesId) => {
      await qc.cancelQueries({ queryKey: testSeriesKeys.series.all });
      // Deleting a PUBLISHED series releases a testseries_count slot; check
      // the cached row's status before bumping the usage badge.
      let wasPublished = false;
      const undoList = patchListCaches<TestSeries>(
        qc,
        testSeriesKeys.series.all,
        "series",
        (s) => {
          if (s.id !== seriesId) return s;
          wasPublished = s.status === "PUBLISHED";
          return null;
        }
      );
      const undoUsage = wasPublished ? patchEntitlementUsage(qc, -1) : () => {};
      return {
        undo: () => {
          undoUsage();
          undoList();
        },
      };
    },
    onError: (_err, _seriesId, ctx) => ctx?.undo(),
    onSettled: () => {
      qc.invalidateQueries({ queryKey: testSeriesKeys.series.all });
      qc.invalidateQueries({ queryKey: entitlementKeys.all });
    },
  });
};

export const usePublishTestSeries = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (seriesId: string) => testSeriesApi.publish(seriesId),
    onMutate: async (seriesId) => {
      await qc.cancelQueries({ queryKey: testSeriesKeys.series.all });
      return { undo: patchSeriesStatus(qc, seriesId, "PUBLISHED", 1) };
    },
    onError: (_err, _seriesId, ctx) => ctx?.undo(),
    onSettled: (_data, _err, seriesId) => {
      qc.invalidateQueries({ queryKey: testSeriesKeys.series.all });
      qc.invalidateQueries({ queryKey: testSeriesKeys.series.detail(seriesId) });
      qc.invalidateQueries({ queryKey: entitlementKeys.all });
    },
  });
};

/**
 * Live `testseries_count` usage. The server returns the actual count of
 * PUBLISHED series from the `test_series` table paired with the entitlement
 * limit, so the displayed number always matches reality even if the usage
 * counter has drifted.
 *
 * Keyed under `testSeriesKeys.series.all` so the existing publish /
 * unpublish / delete mutations (which already invalidate that subtree)
 * automatically refresh this query.
 */
export const useTestSeriesEntitlementUsage = () => {
  return useQuery({
    queryKey: testSeriesKeys.series.entitlementUsage(),
    queryFn: () => testSeriesApi.getEntitlementUsage(),
  });
};

export const useUnpublishTestSeries = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (seriesId: string) => testSeriesApi.unpublish(seriesId),
    onMutate: async (seriesId) => {
      await qc.cancelQueries({ queryKey: testSeriesKeys.series.all });
      return { undo: patchSeriesStatus(qc, seriesId, "DRAFT", -1) };
    },
    onError: (_err, _seriesId, ctx) => ctx?.undo(),
    onSettled: (_data, _err, seriesId) => {
      qc.invalidateQueries({ queryKey: testSeriesKeys.series.all });
      qc.invalidateQueries({ queryKey: testSeriesKeys.series.detail(seriesId) });
      qc.invalidateQueries({ queryKey: entitlementKeys.all });
    },
  });
};

// ---------- Series tests ----------
export const useSeriesTests = (seriesId: string | undefined) => {
  return useQuery({
    queryKey: testSeriesKeys.series.tests(seriesId ?? ""),
    queryFn: () => testSeriesApi.listSeriesTests(seriesId!),
    enabled: !!seriesId,
  });
};

export const useAddTestToSeries = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      seriesId,
      data,
    }: {
      seriesId: string;
      data: { test_id: string; order_index?: number; is_free_preview?: boolean };
    }) => testSeriesApi.addTest(seriesId, data),
    onSuccess: (_, vars) => {
      qc.invalidateQueries({
        queryKey: testSeriesKeys.series.tests(vars.seriesId),
      });
    },
  });
};

export const useRemoveTestFromSeries = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ seriesId, testId }: { seriesId: string; testId: string }) =>
      testSeriesApi.removeTest(seriesId, testId),
    onMutate: async ({ seriesId, testId }) => {
      const key = testSeriesKeys.series.tests(seriesId);
      await qc.cancelQueries({ queryKey: key });
      // This cache is a bare array of series-test rows.
      const prev = qc.getQueryData<Array<{ testId?: string; test_id?: string }>>(key);
      if (Array.isArray(prev)) {
        qc.setQueryData(
          key,
          prev.filter((row) => (row.testId ?? row.test_id) !== testId)
        );
      }
      return {
        undo: () => {
          if (prev !== undefined) qc.setQueryData(key, prev);
        },
      };
    },
    onError: (_err, _vars, ctx) => ctx?.undo(),
    onSettled: (_data, _err, vars) => {
      qc.invalidateQueries({
        queryKey: testSeriesKeys.series.tests(vars.seriesId),
      });
    },
  });
};

// ---------- Rank curves ----------
export const rankCurvesKeys = {
  all: ["test-series", "rank-curves"] as const,
  detail: (id: string) => ["test-series", "rank-curves", id] as const,
};

export const useRankCurves = () => {
  return useQuery({
    queryKey: rankCurvesKeys.all,
    queryFn: () => testRankCurvesApi.list(),
  });
};

export const useRankCurve = (id: string | undefined) => {
  return useQuery({
    queryKey: rankCurvesKeys.detail(id ?? ""),
    queryFn: () => testRankCurvesApi.get(id!),
    enabled: !!id,
  });
};

export const useCreateRankCurve = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateRankCurvePayload) => testRankCurvesApi.create(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: rankCurvesKeys.all });
    },
  });
};

export const useUpdateRankCurve = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      data,
    }: {
      id: string;
      data: Partial<CreateRankCurvePayload>;
    }) => testRankCurvesApi.update(id, data),
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: rankCurvesKeys.all });
      qc.invalidateQueries({ queryKey: rankCurvesKeys.detail(vars.id) });
    },
  });
};

export const useDeleteRankCurve = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => testRankCurvesApi.delete(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: rankCurvesKeys.all });
    },
  });
};

// ---------- Descriptive grading ----------
export const usePendingGrading = (params?: {
  test_id?: string;
  test_series_id?: string;
  page?: number;
  limit?: number;
}) => {
  return useQuery({
    queryKey: testSeriesKeys.grading.pending(params),
    queryFn: () => testGradingApi.listPending(params),
    placeholderData: keepPreviousData,
  });
};

export const useGradingAttempt = (attemptId: string | undefined) => {
  return useQuery({
    queryKey: testSeriesKeys.grading.attempt(attemptId ?? ""),
    queryFn: () => testGradingApi.getAttempt(attemptId!),
    enabled: !!attemptId,
  });
};

export const useGradeAnswer = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      answerId,
      data,
    }: {
      answerId: string;
      data: { marksAwarded: number; remarks?: string };
    }) => testGradingApi.gradeAnswer(answerId, data),
    onSuccess: (result) => {
      // The attempt detail changes (answer now graded, attempt score updated)
      // and the pending queue drops this attempt once fully graded. Invalidate
      // the whole grading subtree so every pending list (any filter) refetches.
      qc.invalidateQueries({
        queryKey: testSeriesKeys.grading.attempt(result.attemptId),
      });
      qc.invalidateQueries({ queryKey: testSeriesKeys.grading.all });
    },
  });
};

// ---------- Question taxonomy + blueprint availability ----------

export const useTaxonomy = (kind?: TaxonomyKind, parentId?: string) =>
  useQuery({
    queryKey: testSeriesKeys.taxonomy.list(kind, parentId),
    queryFn: () => testTaxonomyApi.list(kind, parentId),
    staleTime: 60_000,
  });

export const useCreateTaxonomy = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: {
      kind: TaxonomyKind;
      name: string;
      parentId?: string | null;
    }) => testTaxonomyApi.create(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: testSeriesKeys.taxonomy.all });
    },
  });
};

export const useUpdateTaxonomy = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      nodeId,
      data,
    }: {
      nodeId: string;
      data: { name?: string; parentId?: string | null; orderIndex?: number };
    }) => testTaxonomyApi.update(nodeId, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: testSeriesKeys.taxonomy.all });
    },
  });
};

export const useDeleteTaxonomy = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (nodeId: string) => testTaxonomyApi.remove(nodeId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: testSeriesKeys.taxonomy.all });
    },
  });
};

export const useCheckBlueprintAvailability = () =>
  useMutation({
    mutationFn: (data: {
      questionBankId: string;
      totalCount?: number;
      rules: BlueprintRule[];
    }) => testTaxonomyApi.checkAvailability(data),
  });

export const useImportTaxonomyFromTags = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => testTaxonomyApi.importFromTags(),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: testSeriesKeys.taxonomy.all });
      qc.invalidateQueries({ queryKey: testSeriesKeys.questions.all });
    },
  });
};
