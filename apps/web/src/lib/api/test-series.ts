/**
 * API client for test-series catalog + attempts in the learner-api.
 * Mirrors the learner API response shapes.
 */

import { deepDecodeHtmlEntities } from "../utils";

import { apiGet, apiPatch, apiPost, axiosInstance } from "./api-client";

function getApiBaseUrl(): string {
  const apiUrl = ((typeof window === "undefined" ? process.env.API_INTERNAL_BASE_URL : undefined) || process.env.NEXT_PUBLIC_API_BASE_URL);
  if (apiUrl) return apiUrl.replace(/\/$/, "");
  const port = process.env.NEXT_PUBLIC_USER_SERVER_PORT || "5096";
  return `http://localhost:${port}/api/v1`;
}

import { assetUrl } from "@open-mtlms/shared";
import { THUMBNAILS_BASE_URL } from "@/lib/utils/constants";

/**
 * Resolve a test-series cover image key to a full public URL, against the
 * thumbnails base URL. Already-absolute values (http/https/data) pass through.
 */
export function getTestSeriesCoverUrl(
  coverImageKey: string | null | undefined
): string | null {
  if (!coverImageKey?.trim()) return null;
  const key = coverImageKey.trim();
  if (
    key.startsWith("http://") ||
    key.startsWith("https://") ||
    key.startsWith("data:")
  ) {
    return key;
  }

  return assetUrl(key, THUMBNAILS_BASE_URL);
}

interface ApiResponse<T> {
  success: boolean;
  data: T;
  message?: string;
}

/** One row in a learner's test attempt history (re-attempt analytics). */
export interface TestAttemptSummary {
  id: string;
  attempt_number: number;
  status: string;
  score: number | null;
  percentage: number | null;
  started_at: string;
  submitted_at: string | null;
}

// ---------- Catalog ----------
export interface CatalogSeries {
  id: string;
  title: string;
  slug: string;
  description: string | null;
  coverImageKey: string | null;
  category: string | null;
  pricingType: "FREE" | "PAID";
  priceInr: string | null;
  priceUsd: string | null;
  discountInr: string | null;
  discountUsd: string | null;
  currency: string | null;
  validityDays: number | null;
  visibility: string;
  accessMode: "SEQUENTIAL" | "OPEN";
  totalTests: number;
  /** True when the signed-in member already owns this series. */
  hasAccess: boolean;
  /** PUBLISHED bundles containing this series, powers the "Part of X" chip. */
  bundles?: { id: string; title: string; slug: string }[];
}

export interface SeriesDetailTest {
  id: string;
  name: string;
  description: string | null;
  durationMin: number;
  totalMarks: string;
  /** Questions served per attempt (blueprint + random). Defaults to the pool. */
  servedQuestionCount: number;
  orderIndex: number;
  isFreePreview: boolean;
  allowReattempt: boolean;
  shuffleQuestions: boolean;
  shuffleOptions: boolean;
  showSolutions: "IMMEDIATE" | "AFTER_SERIES_END" | "NEVER";
  passCriteriaPct: number | null;
  /** ADAPTIVE = SAT-style multistage modules. Optional for older payloads. */
  mode?: "STANDARD" | "ADAPTIVE";
  /** Scheduling window; null = always available. ISO strings. */
  availableFrom?: string | null;
  availableUntil?: string | null;
  lastAttemptStatus:
    | "IN_PROGRESS"
    | "ON_BREAK"
    | "SUBMITTED"
    | "AUTO_SUBMITTED"
    | null;
  lastAttemptId: string | null;
  /**
   * What the test's proctoring requires, so the instructions screen can ask
   * for camera/mic before the attempt starts. Optional: older servers omit it.
   */
  proctoring?: {
    enabled: boolean;
    camera: boolean;
    mic: boolean;
    fullscreen: boolean;
  };
}

export interface SeriesDetail extends CatalogSeries {
  tests: SeriesDetailTest[];
  hasAccess: boolean;
}

export interface MyEnrollment {
  id: string;
  testSeriesId: string;
  status: string;
  source: string;
  enrolledAt: string;
  validTill: string | null;
}

// ---------- Attempt ----------
export interface AttemptQuestion {
  id: string;
  type:
    | "MCQ_SINGLE"
    | "MCQ_MULTI"
    | "TRUE_FALSE"
    | "FIB"
    | "NAT"
    | "DRAG_DROP"
    | "DESCRIPTIVE";
  stem: unknown;
  options: unknown;
  marks: string;
  negativeMarks: string;
}

export interface AttemptSection {
  id: string;
  name: string;
  instructions: string | null;
  timeLimitMin: number | null;
  orderIndex: number;
  questionIds: string[];
}

export interface AttemptState {
  attemptId: string;
  status: "IN_PROGRESS" | "SUBMITTED" | "AUTO_SUBMITTED" | "ON_BREAK";
  testId: string;
  seriesId: string;
  startedAt: string;
  submittedAt: string | null;
  timeRemainingSec: number;
  totalDurationSec: number;
  /** ADAPTIVE attempts on an inter-section break: ISO instant the break ends. */
  breakEndsAt?: string | null;
  test: {
    id: string;
    name: string;
    description: string | null;
    durationMin: number;
    totalMarks: string;
    showSolutions: string;
    shuffleQuestions: boolean;
    shuffleOptions: boolean;
    proctoringEnabled?: boolean;
    proctorCamera?: boolean;
    proctorMaxTabSwitches?: number | null;
    proctorMic?: boolean;
    proctorFullscreen?: boolean;
    proctorBlockCopyPaste?: boolean;
    proctorAction?: "WARN" | "AUTO_SUBMIT";
    calculatorMode?: string;
  };
  sections: AttemptSection[];
  questions: AttemptQuestion[];
  answers: Record<string, { answer: unknown; markedForReview: boolean }>;
  mode: "STANDARD" | "ADAPTIVE";
  /**
   * ADAPTIVE attempts only. The envelope above is scoped to the CURRENT
   * module (sections has one entry, questions/answers cover only that
   * module); this block carries module progress metadata.
   */
  adaptive?: AdaptiveAttemptInfo;
}

export interface AdaptiveAttemptInfo {
  attemptModuleId: string | null;
  moduleOrdinal: number;
  totalModules: number;
  sectionName: string | null;
  moduleNumberInSection: number | null;
  moduleStartedAt: string | null;
  moduleDeadline: string | null;
  completedModules: Array<{
    attemptModuleId: string;
    sectionName: string;
    moduleNumberInSection: number;
    questionCount: number;
    answeredCount: number;
  }>;
}

export interface SubmitResult {
  attemptId: string;
  score: number;
  totalMarks: number;
  percentage: number;
  percentile: number;
  rank: number | null;
  scaledScore?: number | null;
  scaledScoreMax?: number | null;
}

export type ModuleSubmitOutcome =
  | { outcome: "NEXT_MODULE"; state: AttemptState }
  | { outcome: "ON_BREAK"; state: AttemptState }
  | { outcome: "COMPLETED"; result: SubmitResult };

// ---------- Result ----------
export interface SectionBreakdown {
  sectionId: string;
  sectionName: string;
  attempted: number;
  correct: number;
  wrong: number;
  skipped: number;
  marks: number;
  accuracyPct: number;
  avgTimePerQuestionSec: number;
}

export interface TopicBreakdown {
  topic: string;
  correctPct: number;
  total: number;
}

export interface ResultQuestion {
  questionId: string;
  type: string;
  stem: unknown;
  options: unknown;
  correctAnswer: unknown;
  yourAnswer: unknown;
  isCorrect: boolean | null;
  marksAwarded: number;
  timeSpentSec: number;
  explanation: string | null;
  bookmarked: boolean;
  /** True when the question was an unscored pilot slot (adaptive only). */
  isPretest?: boolean;
  /**
   * Per-question grading state. DESCRIPTIVE answers await a human evaluator;
   * everything else is auto-graded. Values:
   *   NOT_REQUIRED, auto-graded (MCQ/NAT/etc.)
   *   PENDING_REVIEW, descriptive answer awaiting evaluation
   *   MANUALLY_GRADED, descriptive answer marked by an evaluator
   */
  gradingStatus?: string;
  /** True while a descriptive answer is still awaiting evaluation. */
  pendingReview?: boolean;
  /** Evaluator's feedback on a descriptive answer, shown to the learner once graded. */
  graderRemarks?: string | null;
}

export interface StrengthCell {
  topic: string;
  difficulty: "EASY" | "MEDIUM" | "HARD";
  total: number;
  correct: number;
  pct: number;
}

export interface AdvancedAnalytics {
  strengthHeatmap: StrengthCell[];
  timeEfficiency: number;
  consistency: number;
  examReadiness: number;
  topPercentileAvgScore: number | null;
  recommendations: string[];
}

export interface ProctoringEventResult {
  tabSwitchCount: number;
  maxTabSwitches: number | null;
  limitExceeded: boolean;
  flagCount: number;
}

export interface ResultPayload {
  attemptId: string;
  testId: string;
  status: string;
  startedAt: string;
  submittedAt: string | null;
  score: number;
  totalMarks: number;
  percentage: number;
  correctCount: number;
  wrongCount: number;
  skippedCount: number;
  totalQuestions: number;
  percentile: number | null;
  rank: number | null;
  predictedRankMin: number | null;
  predictedRankMax: number | null;
  passCriteriaPct: number | null;
  passed: boolean | null;
  proctoring: {
    tabSwitchCount: number;
    flagCount: number;
    flags: Array<{ type: string; at: string; detail?: string }>;
  } | null;
  certificate: { certificateNumber: string } | null;
  /** Test offers a certificate but grading isn't finished, issued after evaluation. */
  certificatePending?: boolean;
  scholarship: {
    name: string;
    tierLabel: string | null;
    status: string;
    amount: number | null;
    currency: string | null;
  } | null;
  sectionBreakdown: SectionBreakdown[];
  topicBreakdown: TopicBreakdown[];
  analytics: AdvancedAnalytics | null;
  questions: ResultQuestion[];
  scaledScore: number | null;
  scaledScoreMax: number | null;
  adaptive?: AdaptiveResultBlock | null;
  /**
   * Overall descriptive-grading state for this attempt:
   *   NOT_REQUIRED, no descriptive questions (or all auto-graded)
   *   PENDING_REVIEW, some descriptive answers await evaluation; score is provisional
   *   COMPLETED, all descriptive answers have been marked
   */
  gradingStatus?: string;
  /** Total marks of descriptive answers not yet marked (0 when none). */
  pendingMarks?: number;
}

export interface AdaptiveResultBlock {
  sections: Array<{
    sectionId: string;
    sectionName: string;
    path: string;
    modules: Array<{
      attemptModuleId: string;
      label: string;
      stageNo: number;
      variant: string;
      questionCount: number;
      answeredCount: number;
      rawCorrect: number;
      rawScore: number;
      autoCompleted: boolean;
    }>;
    rawCorrectTotal: number;
    scaledScore: number | null;
    scaleMax: number | null;
    /** Best path's ceiling for this section (max scale_max across configured paths). */
    sectionCeilingMax: number | null;
    /** Module-1 coaching: whether routing gated a harder module. Null when not adaptive. */
    coaching: {
      module1Correct: number;
      module1Total: number;
      neededForHarder: number | null;
      gap: number | null;
      reachedHardest: boolean;
    } | null;
  }>;
  totalScaledScore: number | null;
  totalScaleMax: number | null;
}

// ---------- Catalog (server + client) ----------
export async function fetchTestSeriesCatalog(
  params: { search?: string; category?: string; pricing?: string } = {},
  host?: string
): Promise<CatalogSeries[]> {
  const search = new URLSearchParams();
  if (params.search) search.set("search", params.search);
  if (params.category) search.set("category", params.category);
  if (params.pricing) search.set("pricing", params.pricing);
  const q = search.toString();
  const path = `/test-series${q ? `?${q}` : ""}`;

  if (typeof window !== "undefined") {
    return deepDecodeHtmlEntities(await apiGet<CatalogSeries[]>(path));
  }
  const headers: Record<string, string> = host ? { "X-Tenant-Host": host } : {};
  const response = await fetch(`${getApiBaseUrl()}${path}`, { headers });
  if (!response.ok) throw new Error(`Failed: ${response.status}`);
  const json: ApiResponse<CatalogSeries[]> = await response.json();
  return deepDecodeHtmlEntities(json.data);
}

export async function fetchTestSeriesDetail(
  slug: string,
  host?: string
): Promise<SeriesDetail | null> {
  const path = `/test-series/by-slug/${encodeURIComponent(slug)}`;
  if (typeof window !== "undefined") {
    try {
      return deepDecodeHtmlEntities(await apiGet<SeriesDetail>(path));
    } catch (err) {
      const e = err as { status?: number };
      if (e?.status === 404) return null;
      throw err;
    }
  }
  const headers: Record<string, string> = host ? { "X-Tenant-Host": host } : {};
  const response = await fetch(`${getApiBaseUrl()}${path}`, { headers });
  if (response.status === 404) return null;
  if (!response.ok) throw new Error(`Failed: ${response.status}`);
  const json: ApiResponse<SeriesDetail> = await response.json();
  return deepDecodeHtmlEntities(json.data);
}

// ---------- Authenticated ----------
export const testSeriesClientApi = {
  myEnrollments: async (): Promise<MyEnrollment[]> => {
    return apiGet<MyEnrollment[]>("/test-series/me/enrollments");
  },

  startAttempt: async (testId: string, seriesId: string): Promise<AttemptState> => {
    return apiPost<AttemptState>("/test-attempts/start", {
      test_id: testId,
      series_id: seriesId,
    });
  },

  getAttempt: async (attemptId: string): Promise<AttemptState> => {
    return apiGet<AttemptState>(`/test-attempts/${attemptId}`);
  },

  patchAnswer: async (
    attemptId: string,
    body: {
      question_id: string;
      answer: unknown;
      time_spent_sec?: number;
      marked_for_review?: boolean;
    }
  ): Promise<void> => {
    await apiPatch<unknown>(`/test-attempts/${attemptId}/answer`, body);
  },

  submitAttempt: async (
    attemptId: string,
    tabSwitchCount?: number
  ): Promise<SubmitResult> => {
    return apiPost<SubmitResult>(`/test-attempts/${attemptId}/submit`, {
      tab_switch_count: tabSwitchCount,
    });
  },

  /** Adaptive only: grade the active module, route, and get the next one. */
  submitModule: async (
    attemptId: string,
    attemptModuleId: string
  ): Promise<ModuleSubmitOutcome> => {
    return apiPost<ModuleSubmitOutcome>(
      `/test-attempts/${attemptId}/modules/${attemptModuleId}/submit`
    );
  },

  /**
   * Adaptive only: end the current inter-section break early ("Resume now").
   * Activates the next section's module and returns the fresh attempt state.
   */
  resumeBreak: async (attemptId: string): Promise<AttemptState> => {
    return apiPost<AttemptState>(`/test-attempts/${attemptId}/resume-break`);
  },

  /**
   * Report a proctoring violation (tab switch, fullscreen exit, copy/paste,
   * camera/mic loss…). Returns the running tab-switch count + whether the
   * configured limit has been exceeded so the client can enforce the action.
   */
  recordProctoringEvent: async (
    attemptId: string,
    event: { type: string; count?: number; detail?: string }
  ): Promise<ProctoringEventResult> => {
    return apiPost<ProctoringEventResult>(
      `/test-attempts/${attemptId}/proctoring-event`,
      event
    );
  },

  getResult: async (attemptId: string): Promise<ResultPayload> => {
    return apiGet<ResultPayload>(`/test-attempts/${attemptId}/result`);
  },

  /** A learner's full attempt history for a test (newest first). */
  listAttempts: async (testId: string): Promise<TestAttemptSummary[]> => {
    const res = await apiGet<{ attempts: TestAttemptSummary[] }>(
      `/test-attempts/by-test/${testId}`
    );
    return res?.attempts ?? [];
  },

  /**
   * Download the PDF report card. Triggers a browser download via blob URL.
   * The endpoint streams binary PDF; we fetch as a blob and create an object URL.
   */
  downloadResultPdf: async (attemptId: string): Promise<void> => {
    const response = await axiosInstance.get<Blob>(
      `/test-attempts/${attemptId}/report-card.pdf`,
      { responseType: "blob" }
    );
    const blob = response.data;
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `report-${attemptId}.pdf`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  },
};
