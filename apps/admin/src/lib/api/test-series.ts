import type { ContentPrice } from "@open-mtlms/shared";
import axios from "axios";

import type { ApiResponse } from "../types/auth";

import { apiClient } from "./axios";

const BANKS_BASE = "/tenant/test-question-banks";
const QUESTIONS_BASE = "/tenant/test-questions";
const TESTS_BASE = "/tenant/tests";
const SERIES_BASE = "/tenant/test-series";

// ---- Question banks ----
export interface TestQuestionBank {
  id: string;
  tenantId: string;
  name: string;
  description: string | null;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface QuestionBanksListResponse {
  banks: TestQuestionBank[];
  total: number;
  page: number;
  limit: number;
}

// ---- Questions ----
export type TestQuestionType =
  | "MCQ_SINGLE"
  | "MCQ_MULTI"
  | "TRUE_FALSE"
  | "FIB"
  | "NAT"
  | "DRAG_DROP"
  | "DESCRIPTIVE";
export type TestQuestionDifficulty = "EASY" | "MEDIUM" | "HARD";
export type TestQuestionStatus = "DRAFT" | "PUBLISHED" | "ARCHIVED";
export type TestQuestionCreatedVia = "MANUAL" | "IMPORT" | "AI";

export interface TestQuestion {
  id: string;
  tenantId: string;
  questionBankId: string;
  type: TestQuestionType;
  stem: unknown;
  options: unknown;
  correctAnswer: unknown;
  explanation: string | null;
  marks: string;
  negativeMarks: string;
  difficulty: TestQuestionDifficulty;
  subject: string | null;
  chapter: string | null;
  topic: string | null;
  subjectNodeId: string | null;
  chapterNodeId: string | null;
  topicNodeId: string | null;
  source: string | null;
  status: TestQuestionStatus;
  createdVia: TestQuestionCreatedVia;
  aiMetadata: unknown;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface QuestionsListResponse {
  questions: TestQuestion[];
  total: number;
  page: number;
  limit: number;
}

export interface CreateQuestionPayload {
  question_bank_id: string;
  type: TestQuestionType;
  stem: unknown;
  options?: unknown;
  /** Omitted for DESCRIPTIVE (human-graded); required for all other types. */
  correct_answer?: unknown;
  explanation?: string | null;
  marks?: number;
  negative_marks?: number;
  difficulty?: TestQuestionDifficulty;
  subject?: string | null;
  chapter?: string | null;
  topic?: string | null;
  subject_node_id?: string | null;
  chapter_node_id?: string | null;
  topic_node_id?: string | null;
  source?: string | null;
  status?: TestQuestionStatus;
  created_via?: TestQuestionCreatedVia;
}

// ---- Tests ----
export type TestStatus = "DRAFT" | "PUBLISHED" | "ARCHIVED";
export type TestShowSolutions = "IMMEDIATE" | "AFTER_SERIES_END" | "NEVER";
export type TestMode = "STANDARD" | "ADAPTIVE";

export interface Test {
  id: string;
  tenantId: string;
  name: string;
  description: string | null;
  coverImageKey: string | null;
  durationMin: number;
  totalMarks: string;
  status: TestStatus;
  shuffleQuestions: boolean;
  shuffleOptions: boolean;
  /** Random questions served per attempt. null = serve all questions. */
  randomQuestionCount: number | null;
  /**
   * Lowest and highest total a learner could be scored out of. Equal unless a
   * section's pool mixes marks while serving a random subset, in which case
   * different learners sit papers worth different totals. null when every
   * learner gets the same paper.
   */
  servedMarksMin?: number | null;
  servedMarksMax?: number | null;
  /** STANDARD = linear test; ADAPTIVE = SAT-style multistage modules. Immutable after creation. */
  mode: TestMode;
  showSolutions: TestShowSolutions;
  allowReattempt: boolean;
  /** Max attempts when allowReattempt is on; null = unlimited. */
  maxAttempts: number | null;
  proctoringEnabled: boolean;
  proctorCamera: boolean;
  proctorMaxTabSwitches: number | null;
  proctorMic: boolean;
  proctorFullscreen: boolean;
  proctorBlockCopyPaste: boolean;
  /** Action when a proctoring limit is exceeded. */
  proctorAction: "WARN" | "AUTO_SUBMIT";
  /** Scheduling window; null = always available. ISO strings. */
  availableFrom: string | null;
  availableUntil: string | null;
  certificateEnabled: boolean;
  certificateTemplateId: string | null;
  certificateMinScorePct: string | null;
  calculatorMode: string;
  passCriteriaPct: string | null;
  targetExam: string | null;
  targetRankCurveId: string | null;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
  /** Non-blocking publish findings (adaptive: e.g., unreachable modules). */
  publishWarnings?: string[];
}

export interface TestsListResponse {
  tests: Test[];
  total: number;
  page: number;
  limit: number;
}

export interface TestAttemptReport {
  id: string;
  /** Present on the series (batch) report, which test this attempt belongs to. */
  testId?: string;
  testName?: string;
  /** Present on the series + learner reports. */
  seriesId?: string;
  seriesTitle?: string;
  learnerId: string;
  learnerName: string;
  learnerEmail: string | null;
  learnerPhone: string | null;
  status: string;
  score: number | null;
  percentage: number | null;
  /**
   * Marks this attempt was graded out of. Random-X and blueprint tests serve a
   * different question set per learner, so the same score can legitimately show
   * a different percentage, always render the score against this.
   */
  totalMarks: number | null;
  scaledScore: number | null;
  scaledScoreMax: number | null;
  percentile: number | null;
  rank: number | null;
  startedAt: string;
  submittedAt: string | null;
  durationSec: number | null;
  tabSwitchCount: number;
  flagCount: number;
  flags: Array<{ type: string; at: string; detail?: string }>;
}

/** A learner who has sat at least one test. */
export interface TestLearnerSummary {
  learnerId: string;
  name: string;
  email: string | null;
  phone: string | null;
  attemptCount: number;
  testCount: number;
  submittedCount: number;
  avgPercentage: number | null;
  lastSubmittedAt: string | null;
}

export interface TestLearnersResponse {
  learners: TestLearnerSummary[];
  total: number;
  page: number;
  limit: number;
}

/** Everything one learner has sat, across every series. */
export interface LearnerAttempts {
  learner: {
    learnerId: string;
    name: string;
    email: string | null;
    phone: string | null;
  };
  summary: {
    attemptCount: number;
    testCount: number;
    submittedCount: number;
    avgPercentage: number | null;
  };
  attempts: TestAttemptReport[];
}

/** One learner's attempt, question by question (faculty review). */
export interface AttemptReviewQuestion {
  questionId: string;
  order: number;
  sectionId: string | null;
  sectionName: string | null;
  type: TestQuestionType;
  difficulty: TestQuestionDifficulty | null;
  stem: unknown;
  options: unknown;
  correctAnswer: unknown;
  explanation: string | null;
  marks: number;
  negativeMarks: number;
  subject: string | null;
  chapter: string | null;
  topic: string | null;
  isPretest: boolean;
  outcome: "CORRECT" | "WRONG" | "SKIPPED" | "PENDING_REVIEW";
  learnerAnswer: unknown;
  isCorrect: boolean | null;
  marksAwarded: number;
  timeSpentSec: number;
  markedForReview: boolean;
  gradingStatus: string;
  graderRemarks: string | null;
}

export interface AttemptReview {
  attempt: {
    id: string;
    testId: string;
    testName: string;
    testMode: string;
    seriesId: string | null;
    seriesTitle: string | null;
    learnerId: string;
    learnerName: string;
    learnerEmail: string | null;
    learnerPhone: string | null;
    status: string;
    gradingStatus: string;
    score: number | null;
    totalMarks: number | null;
    percentage: number | null;
    percentile: number | null;
    rank: number | null;
    scaledScore: number | null;
    scaledScoreMax: number | null;
    passCriteriaPct: number | null;
    tabSwitchCount: number;
    startedAt: string | null;
    submittedAt: string | null;
    durationSec: number | null;
    correctCount: number;
    wrongCount: number;
    skippedCount: number;
    pendingReviewCount: number;
  };
  questions: AttemptReviewQuestion[];
}

export interface TestAnalytics {
  test: {
    id: string;
    title: string;
    mode: string;
    passCriteriaPct: number | null;
    totalMarks: number | null;
    questionCount: number;
  };
  kpis: {
    totalAttempts: number;
    submitted: number;
    inProgress: number;
    avgScore: number;
    medianScore: number;
    highScore: number;
    lowScore: number;
    avgPercentage: number;
    passRate: number;
    avgPercentile: number;
    avgDurationSec: number;
    avgTabSwitches: number;
  };
  scoreDistribution: Array<{ bucket: string; count: number }>;
  difficulty: Array<{
    difficulty: string;
    answered: number;
    correct: number;
    accuracyPct: number;
  }>;
  typeBreakdown: Array<{
    type: string;
    answered: number;
    correct: number;
    accuracyPct: number;
  }>;
  funnel: { started: number; submitted: number; passed: number };
  percentileBands: Array<{ band: string; count: number }>;
  topics: Array<{
    topic: string;
    answered: number;
    correct: number;
    accuracyPct: number;
    avgTimeSec: number;
  }>;
  questions: Array<{
    questionId: string;
    stem: string;
    type: string;
    difficulty: string;
    topic: string;
    answered: number;
    correct: number;
    accuracyPct: number;
    avgTimeSec: number;
  }>;
  leaderboard: Array<{
    rank: number | null;
    learnerName: string;
    learnerEmail: string;
    score: number;
    percentage: number;
    percentile: number | null;
    durationSec: number | null;
    attempts: number;
  }>;
  learners: Array<{
    learnerId: string;
    name: string;
    email: string;
    status: string;
    score: number | null;
    percentage: number | null;
    percentile: number | null;
    rank: number | null;
    durationSec: number | null;
    tabSwitchCount: number;
    attempts: number;
    attemptHistory: Array<{
      status: string;
      score: number | null;
      percentage: number | null;
      percentile: number | null;
      durationSec: number | null;
      startedAt: string | null;
      submittedAt: string | null;
    }>;
  }>;
  insights: string[];
}

export interface TestSection {
  id: string;
  tenantId: string;
  testId: string;
  name: string;
  instructions: string | null;
  timeLimitMin: number | null;
  orderIndex: number;
  markingScheme: unknown;
  /** Per-section pooling blueprint (rules). null = no blueprint. */
  questionSelection?: SectionBlueprint | null;
  /** Bank this section pools from when a blueprint is defined. */
  questionBankId?: string | null;
  /** Random questions served per attempt for this section. null = serve all. */
  randomQuestionCount?: number | null;
  createdAt: string;
  updatedAt: string;
}

export interface TestSectionQuestion {
  id: string;
  testId: string;
  sectionId: string;
  questionId: string;
  orderIndex: number;
  marksOverride: string | null;
}

export interface TestFullTree {
  test: Test;
  sections: Array<TestSection & { questions: TestSectionQuestion[] }>;
  questions: TestQuestion[];
}

export interface CreateTestPayload {
  name: string;
  description?: string | null;
  cover_image_key?: string | null;
  duration_min: number;
  show_solutions?: TestShowSolutions;
  allow_reattempt?: boolean;
  max_attempts?: number | null;
  proctoring_enabled?: boolean;
  proctor_camera?: boolean;
  proctor_max_tab_switches?: number | null;
  proctor_mic?: boolean;
  proctor_fullscreen?: boolean;
  proctor_block_copy_paste?: boolean;
  proctor_action?: "WARN" | "AUTO_SUBMIT";
  available_from?: string | null;
  available_until?: string | null;
  certificate_enabled?: boolean;
  certificate_template_id?: string | null;
  certificate_min_score_pct?: number | null;
  calculator_mode?: string;
  shuffle_questions?: boolean;
  shuffle_options?: boolean;
  random_question_count?: number | null;
  pass_criteria_pct?: number | null;
  target_exam?: string | null;
  target_rank_curve_id?: string | null;
  mode?: TestMode;
}

export interface CreateTestFullPayload {
  name: string;
  description?: string | null;
  cover_image_key?: string | null;
  duration_min: number;
  pass_criteria_pct?: number | null;
  shuffle_questions?: boolean;
  shuffle_options?: boolean;
  show_solutions?: TestShowSolutions;
  allow_reattempt?: boolean;
  calculator_mode?: string;
  target_exam?: string | null;
  sections: Array<{
    name: string;
    instructions?: string | null;
    time_limit_min?: number | null;
    order_index?: number;
    marking_scheme?: unknown;
    question_ids: string[];
    question_selection?: SectionBlueprint | null;
    question_bank_id?: string | null;
    random_question_count?: number | null;
  }>;
}

// ---- Test series ----
export type TestSeriesPricingType = "FREE" | "PAID";
export type TestSeriesVisibility = "PUBLIC" | "UNLISTED" | "PRIVATE";
export type TestSeriesAccessMode = "SEQUENTIAL" | "OPEN";

export interface TestSeries {
  id: string;
  /** Bundles containing this series, drives the "Part of X" chip. */
  bundles?: { id: string; title: string; slug: string }[];
  tenantId: string;
  title: string;
  slug: string;
  description: string | null;
  coverImageKey: string | null;
  category: string | null;
  pricingType: TestSeriesPricingType;
  priceInr: string | null;
  priceUsd: string | null;
  discountInr: string | null;
  discountUsd: string | null;
  /** Multi-currency price book (returned on detail GETs). */
  prices?: ContentPrice[];
  currency: string | null;
  validityDays: number | null;
  endDate: string | null;
  visibility: TestSeriesVisibility;
  accessMode: TestSeriesAccessMode;
  status: TestStatus;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface SeriesListResponse {
  series: TestSeries[];
  total: number;
  page: number;
  limit: number;
}

export interface SeriesTestRow {
  id: string;
  testSeriesId: string;
  testId: string;
  orderIndex: number;
  isFreePreview: boolean;
}

export interface CreateSeriesPayload {
  title: string;
  slug?: string;
  description?: string | null;
  cover_image_key?: string | null;
  category?: string | null;
  pricing_type?: TestSeriesPricingType;
  price_inr?: number | null;
  price_usd?: number | null;
  discount_inr?: number | null;
  discount_usd?: number | null;
  prices?: ContentPrice[];
  currency?: string | null;
  validity_days?: number | null;
  end_date?: string | null;
  visibility?: TestSeriesVisibility;
  access_mode?: TestSeriesAccessMode;
}

// ---- Coupons ----
// ---- Rank curves ----
export interface CurvePoint {
  percentile: number;
  rank: number;
}

export interface TestRankCurve {
  id: string;
  tenantId: string;
  examName: string;
  year: number;
  totalCandidates: number;
  curve: CurvePoint[];
  createdAt: string;
  updatedAt: string;
}

export interface CreateRankCurvePayload {
  exam_name: string;
  year: number;
  total_candidates: number;
  curve?: CurvePoint[];
  csv?: string;
}

const RANK_CURVES_BASE = "/tenant/test-rank-curves";

export const testRankCurvesApi = {
  list: async (): Promise<TestRankCurve[]> => {
    const r = await apiClient.get<ApiResponse<TestRankCurve[]>>(RANK_CURVES_BASE);
    return r.data.data;
  },
  get: async (id: string): Promise<TestRankCurve> => {
    const r = await apiClient.get<ApiResponse<TestRankCurve>>(`${RANK_CURVES_BASE}/${id}`);
    return r.data.data;
  },
  create: async (data: CreateRankCurvePayload): Promise<TestRankCurve> => {
    const r = await apiClient.post<ApiResponse<TestRankCurve>>(RANK_CURVES_BASE, data);
    return r.data.data;
  },
  update: async (
    id: string,
    data: Partial<CreateRankCurvePayload>
  ): Promise<TestRankCurve> => {
    const r = await apiClient.put<ApiResponse<TestRankCurve>>(
      `${RANK_CURVES_BASE}/${id}`,
      data
    );
    return r.data.data;
  },
  delete: async (id: string): Promise<void> => {
    await apiClient.delete(`${RANK_CURVES_BASE}/${id}`);
  },
};

function qs(params?: Record<string, unknown>): string {
  if (!params) return "";
  const search = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null && v !== "") search.set(k, String(v));
  }
  const s = search.toString();
  return s ? `?${s}` : "";
}

export const testQuestionBanksApi = {
  list: async (params?: { page?: number; limit?: number; search?: string }) => {
    const r = await apiClient.get<ApiResponse<QuestionBanksListResponse>>(
      `${BANKS_BASE}${qs(params)}`
    );
    return r.data.data;
  },
  get: async (bankId: string) => {
    const r = await apiClient.get<ApiResponse<TestQuestionBank>>(`${BANKS_BASE}/${bankId}`);
    return r.data.data;
  },
  create: async (data: { name: string; description?: string | null }) => {
    const r = await apiClient.post<ApiResponse<TestQuestionBank>>(BANKS_BASE, data);
    return r.data.data;
  },
  update: async (
    bankId: string,
    data: { name?: string; description?: string | null }
  ) => {
    const r = await apiClient.put<ApiResponse<TestQuestionBank>>(
      `${BANKS_BASE}/${bankId}`,
      data
    );
    return r.data.data;
  },
  delete: async (bankId: string) => {
    await apiClient.delete(`${BANKS_BASE}/${bankId}`);
  },
};

// ---- AI Generation ----
export type AIJobState =
  | "waiting"
  | "active"
  | "delayed"
  | "completed"
  | "failed"
  | "paused"
  | "stuck"
  | "not_found"
  | "unknown";

export interface AIJobProgress {
  status: "pending" | "extracting" | "generating" | "saving" | "completed" | "failed";
  pageCount?: number;
  chunksTotal?: number;
  chunksDone?: number;
  questionsGenerated?: number;
  questionsSaved?: number;
  error?: string;
}

export interface AIJobStatusResponse {
  jobId: string;
  state: AIJobState;
  progress: AIJobProgress | null;
  failedReason?: string | null;
}

export interface AIGenerateConfig {
  count: number;
  types: TestQuestionType[];
  difficultyMix: { easy: number; medium: number; hard: number };
  language: "en" | "hi";
  subject?: string | null;
  chapter?: string | null;
  topic?: string | null;
}

interface AIUploadUrlResponse {
  uploadUrl: string;
  s3Key: string;
  expiresIn: number;
  maxFileSizeBytes: number;
  contentType: string;
}

export const testAIApi = {
  /**
   * Submit a PDF for AI question generation. Three steps:
   *   1. Ask the backend for a presigned S3 PUT URL.
   *   2. Upload the PDF directly to S3 (bypasses the Amplify SSR proxy, which
   *      otherwise caps request bodies at ~6 MB and was returning 413).
   *   3. POST a small JSON payload to the backend with the S3 key + config so
   *      the worker can pull the PDF from S3.
   */
  submitGeneration: async (
    bankId: string,
    file: File,
    config: AIGenerateConfig
  ): Promise<{ jobId: string }> => {
    if (file.type !== "application/pdf") {
      throw new Error("Only PDF files are supported");
    }

    const presign = await apiClient.get<ApiResponse<AIUploadUrlResponse>>(
      `${QUESTIONS_BASE}/banks/${bankId}/ai-generate/upload-url`
    );
    const { uploadUrl, s3Key, maxFileSizeBytes, contentType } =
      presign.data.data;

    if (file.size > maxFileSizeBytes) {
      const limitMb = Math.floor(maxFileSizeBytes / 1024 / 1024);
      throw new Error(`PDF too large. Max ${limitMb} MB`);
    }

    // Bare axios, no Authorization / x-tenant-id headers (S3 rejects those),
    // and we don't want the apiClient interceptor remapping S3 errors.
    await axios.put(uploadUrl, file, {
      headers: { "Content-Type": contentType },
      // Allow plenty of time for large uploads on slow uplinks.
      timeout: 300_000,
    });

    const submit = await apiClient.post<ApiResponse<{ jobId: string }>>(
      `${QUESTIONS_BASE}/banks/${bankId}/ai-generate`,
      {
        s3Key,
        count: config.count,
        types: config.types,
        easy: config.difficultyMix.easy,
        medium: config.difficultyMix.medium,
        hard: config.difficultyMix.hard,
        language: config.language,
        subject: config.subject ?? null,
        chapter: config.chapter ?? null,
        topic: config.topic ?? null,
      }
    );
    return submit.data.data;
  },
  getStatus: async (jobId: string): Promise<AIJobStatusResponse> => {
    const r = await apiClient.get<ApiResponse<AIJobStatusResponse>>(
      `${QUESTIONS_BASE}/ai/status/${jobId}`
    );
    return r.data.data;
  },
};

// ---- Test-series metadata AI (title / description / cover) ----
export type TestSeriesAIKind = "title" | "description" | "cover";

export type TestSeriesAIInput =
  | { kind: "title"; topic?: string | null; category?: string | null }
  | {
      kind: "description";
      title: string;
      category?: string | null;
      extraContext?: string | null;
    }
  | {
      kind: "cover";
      title: string;
      category?: string | null;
      description?: string | null;
    };

export interface TestSeriesAIJobProgress {
  status: "pending" | "generating" | "completed" | "failed";
  kind: TestSeriesAIKind;
  result?:
    | { kind: "title"; text: string }
    | { kind: "description"; text: string }
    | { kind: "cover"; dataUrl: string };
  error?: string;
}

export interface TestSeriesAIJobStatus {
  jobId: string;
  state: AIJobState;
  progress: TestSeriesAIJobProgress | null;
  failedReason?: string | null;
}

export const testSeriesAIApi = {
  submit: async (input: TestSeriesAIInput): Promise<{ jobId: string }> => {
    const r = await apiClient.post<
      ApiResponse<{ jobId: string; kind: TestSeriesAIKind }>
    >(`${SERIES_BASE}/ai/generate`, input);
    return { jobId: r.data.data.jobId };
  },
  getStatus: async (jobId: string): Promise<TestSeriesAIJobStatus> => {
    const r = await apiClient.get<ApiResponse<TestSeriesAIJobStatus>>(
      `${SERIES_BASE}/ai/status/${jobId}`
    );
    return r.data.data;
  },
};

export interface RandomPickPayload {
  question_bank_ids: string[];
  count: number;
  /** Percentages; must sum to 100. */
  distribution: { easy: number; medium: number; hard: number };
  exclude_question_ids?: string[];
}

export interface RandomPickSummary {
  requested: { easy: number; medium: number; hard: number };
  picked: { easy: number; medium: number; hard: number };
  /** count minus questions actually returned (pool exhausted). */
  shortfall: number;
}

export interface RandomPickResult {
  questions: TestQuestion[];
  summary: RandomPickSummary;
}

export const testQuestionsApi = {
  list: async (params: {
    question_bank_id?: string;
    page?: number;
    limit?: number;
    search?: string;
    type?: TestQuestionType;
    difficulty?: TestQuestionDifficulty;
    status?: TestQuestionStatus;
    subject?: string;
    chapter?: string;
    topic?: string;
    subject_node_id?: string;
    chapter_node_id?: string;
    topic_node_id?: string;
    created_via?: TestQuestionCreatedVia;
  }) => {
    const r = await apiClient.get<ApiResponse<QuestionsListResponse>>(
      `${QUESTIONS_BASE}${qs(params)}`
    );
    return r.data.data;
  },
  get: async (questionId: string) => {
    const r = await apiClient.get<ApiResponse<TestQuestion>>(
      `${QUESTIONS_BASE}/${questionId}`
    );
    return r.data.data;
  },
  getByIds: async (ids: string[]): Promise<TestQuestion[]> => {
    if (ids.length === 0) return [];
    const r = await apiClient.post<ApiResponse<TestQuestion[]>>(
      `${QUESTIONS_BASE}/by-ids`,
      { ids }
    );
    return r.data.data;
  },
  randomPick: async (data: RandomPickPayload): Promise<RandomPickResult> => {
    const r = await apiClient.post<ApiResponse<RandomPickResult>>(
      `${QUESTIONS_BASE}/random-pick`,
      data
    );
    return r.data.data;
  },
  create: async (data: CreateQuestionPayload) => {
    const r = await apiClient.post<ApiResponse<TestQuestion>>(QUESTIONS_BASE, data);
    return r.data.data;
  },
  /** Upload a Word/PDF/Excel/CSV file → AI parses it into questions. */
  importFileAI: async (
    bankId: string,
    file: File
  ): Promise<{ created: number; parsed: number; skipped: number }> => {
    const form = new FormData();
    form.append("file", file);
    const r = await apiClient.post<
      ApiResponse<{ created: number; parsed: number; skipped: number }>
    >(`${QUESTIONS_BASE}/banks/${bankId}/import-ai`, form, {
      headers: { "Content-Type": "multipart/form-data" },
    });
    return r.data.data;
  },
  /**
   * Download the ready-to-fill Word (.docx) question template. Triggers a
   * programmatic browser download via a Blob URL (tenant JWT comes along through
   * the shared Axios client).
   */
  downloadDocxTemplate: async (): Promise<void> => {
    const res = await apiClient.get<Blob>(
      `${QUESTIONS_BASE}/import/docx-template`,
      { responseType: "blob" }
    );
    const url = URL.createObjectURL(res.data);
    const a = document.createElement("a");
    a.href = url;
    a.download = "question-import-template.docx";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  },
  bulkImport: async (
    bankId: string,
    questions: Omit<CreateQuestionPayload, "question_bank_id">[]
  ) => {
    const r = await apiClient.post<
      ApiResponse<{
        created: number;
        failed: Array<{ index: number; error: string }>;
        skipped?: number;
        duplicates?: Array<{ question: string; reason: string }>;
      }>
    >(`${QUESTIONS_BASE}/banks/${bankId}/bulk-import`, { questions });
    return r.data.data;
  },
  update: async (questionId: string, data: Partial<CreateQuestionPayload>) => {
    const r = await apiClient.put<ApiResponse<TestQuestion>>(
      `${QUESTIONS_BASE}/${questionId}`,
      data
    );
    return r.data.data;
  },
  delete: async (questionId: string) => {
    await apiClient.delete(`${QUESTIONS_BASE}/${questionId}`);
  },
  bulkUpdateStatus: async (questionIds: string[], status: TestQuestionStatus) => {
    const r = await apiClient.post<ApiResponse<{ updated: number }>>(
      `${QUESTIONS_BASE}/bulk-status`,
      { questionIds, status }
    );
    return r.data.data;
  },
};

export const testsApi = {
  list: async (params?: {
    page?: number;
    limit?: number;
    status?: TestStatus;
    search?: string;
  }) => {
    const r = await apiClient.get<ApiResponse<TestsListResponse>>(
      `${TESTS_BASE}${qs(params)}`
    );
    return r.data.data;
  },
  get: async (testId: string) => {
    const r = await apiClient.get<ApiResponse<Test>>(`${TESTS_BASE}/${testId}`);
    return r.data.data;
  },
  getFull: async (testId: string) => {
    const r = await apiClient.get<ApiResponse<TestFullTree>>(`${TESTS_BASE}/${testId}/full`);
    return r.data.data;
  },
  listAttempts: async (testId: string): Promise<TestAttemptReport[]> => {
    const r = await apiClient.get<ApiResponse<{ attempts: TestAttemptReport[] }>>(
      `${TESTS_BASE}/${testId}/attempts`
    );
    return r.data.data?.attempts ?? [];
  },

  /** Learners who have sat any test, for the staff learner picker. */
  listLearners: async (params: {
    search?: string;
    page?: number;
    limit?: number;
  }): Promise<TestLearnersResponse> => {
    const r = await apiClient.get<ApiResponse<TestLearnersResponse>>(
      `${TESTS_BASE}/learners${qs(params)}`
    );
    return r.data.data;
  },

  /** Every test one learner has taken, across all series. */
  getLearnerAttempts: async (learnerId: string): Promise<LearnerAttempts> => {
    const r = await apiClient.get<ApiResponse<LearnerAttempts>>(
      `${TESTS_BASE}/learners/${learnerId}/attempts`
    );
    return r.data.data;
  },

  /** One learner's attempt replayed question by question. */
  getAttemptReview: async (attemptId: string): Promise<AttemptReview> => {
    const r = await apiClient.get<ApiResponse<AttemptReview>>(
      `${TESTS_BASE}/attempts/${attemptId}/review`
    );
    return r.data.data;
  },

  getAnalytics: async (testId: string): Promise<TestAnalytics> => {
    const r = await apiClient.get<ApiResponse<TestAnalytics>>(
      `${TESTS_BASE}/${testId}/analytics`
    );
    return r.data.data;
  },

  /** Download the detailed .xlsx analytics report (charts + insights). */
  exportAnalytics: async (testId: string): Promise<Blob> => {
    const r = await apiClient.get(`${TESTS_BASE}/${testId}/analytics-export`, {
      responseType: "blob",
    });
    return r.data as Blob;
  },

  /** Series analytics, same shape as a test, aggregated across all its tests. */
  getSeriesAnalytics: async (seriesId: string): Promise<TestAnalytics> => {
    const r = await apiClient.get<ApiResponse<TestAnalytics>>(
      `${SERIES_BASE}/${seriesId}/analytics`
    );
    return r.data.data;
  },

  exportSeriesAnalytics: async (seriesId: string): Promise<Blob> => {
    const r = await apiClient.get(`${SERIES_BASE}/${seriesId}/analytics-export`, {
      responseType: "blob",
    });
    return r.data as Blob;
  },

  /** Batch-wise report: all attempts across every test in a series. */
  listSeriesAttempts: async (seriesId: string): Promise<TestAttemptReport[]> => {
    const r = await apiClient.get<ApiResponse<{ attempts: TestAttemptReport[] }>>(
      `${SERIES_BASE}/${seriesId}/attempts`
    );
    return r.data.data?.attempts ?? [];
  },
  create: async (data: CreateTestPayload) => {
    const r = await apiClient.post<ApiResponse<Test>>(TESTS_BASE, data);
    return r.data.data;
  },
  createFull: async (data: CreateTestFullPayload) => {
    const r = await apiClient.post<ApiResponse<TestFullTree>>(`${TESTS_BASE}/full`, data);
    return r.data.data;
  },
  update: async (testId: string, data: Partial<CreateTestPayload> & { status?: TestStatus }) => {
    const r = await apiClient.put<ApiResponse<Test>>(`${TESTS_BASE}/${testId}`, data);
    return r.data.data;
  },
  delete: async (testId: string) => {
    await apiClient.delete(`${TESTS_BASE}/${testId}`);
  },
  publish: async (testId: string) => {
    const r = await apiClient.post<ApiResponse<Test>>(`${TESTS_BASE}/${testId}/publish`);
    return r.data.data;
  },
  unpublish: async (testId: string) => {
    const r = await apiClient.post<ApiResponse<Test>>(`${TESTS_BASE}/${testId}/unpublish`);
    return r.data.data;
  },
  // Sections
  listSections: async (testId: string) => {
    const r = await apiClient.get<ApiResponse<TestSection[]>>(
      `${TESTS_BASE}/${testId}/sections`
    );
    return r.data.data;
  },
  createSection: async (
    testId: string,
    data: { name: string; instructions?: string | null; time_limit_min?: number | null; order_index?: number; marking_scheme?: unknown }
  ) => {
    const r = await apiClient.post<ApiResponse<TestSection>>(
      `${TESTS_BASE}/${testId}/sections`,
      data
    );
    return r.data.data;
  },
  updateSection: async (
    testId: string,
    sectionId: string,
    data: {
      name?: string;
      instructions?: string | null;
      time_limit_min?: number | null;
      order_index?: number;
      marking_scheme?: unknown;
      question_selection?: SectionBlueprint | null;
      question_bank_id?: string | null;
      random_question_count?: number | null;
    }
  ) => {
    const r = await apiClient.put<ApiResponse<TestSection>>(
      `${TESTS_BASE}/${testId}/sections/${sectionId}`,
      data
    );
    return r.data.data;
  },
  deleteSection: async (testId: string, sectionId: string) => {
    await apiClient.delete(`${TESTS_BASE}/${testId}/sections/${sectionId}`);
  },
  addSectionQuestions: async (
    testId: string,
    sectionId: string,
    items: Array<{ question_id: string; order_index?: number; marks_override?: number | null }>
  ) => {
    const r = await apiClient.post<ApiResponse<{ added: number }>>(
      `${TESTS_BASE}/${testId}/sections/${sectionId}/questions`,
      { items }
    );
    return r.data.data;
  },
  removeSectionQuestion: async (
    testId: string,
    sectionId: string,
    questionId: string
  ) => {
    await apiClient.delete(
      `${TESTS_BASE}/${testId}/sections/${sectionId}/questions/${questionId}`
    );
  },
  reorderSectionQuestions: async (
    testId: string,
    sectionId: string,
    orderedQuestionIds: string[]
  ) => {
    const r = await apiClient.post<ApiResponse<{ reordered: number }>>(
      `${TESTS_BASE}/${testId}/sections/${sectionId}/questions/reorder`,
      { orderedQuestionIds }
    );
    return r.data.data;
  },
};

// ---- Adaptive modules (mode = ADAPTIVE tests) ----
export interface RoutingRule {
  min_correct: number;
  next_variant: string;
}

export interface TestModule {
  id: string;
  testId: string;
  sectionId: string;
  stageNo: number;
  variant: string;
  difficultyRank: number;
  questionCount: number;
  pretestCount: number;
  timeLimitMin: number;
  routingRules: RoutingRule[] | null;
  createdAt: string;
  updatedAt: string;
}

export interface TestModuleWithQuestions extends TestModule {
  questions: Array<{ questionId: string; isPretest: boolean; orderIndex: number }>;
}

export interface TestScoreScale {
  id: string;
  testId: string;
  sectionId: string;
  pathKey: string;
  scale: number[];
  scaleMax: number;
}

export interface TestNormTablePoint {
  score: number;
  percentile: number;
}

export interface TestNormTable {
  testId: string;
  points: TestNormTablePoint[];
  maxScore: number;
}

export interface TestModulesResponse {
  modules: TestModuleWithQuestions[];
  scoreScales: TestScoreScale[];
  normTable: TestNormTable | null;
}

export interface CreateModulePayload {
  stage_no: number;
  variant: string;
  difficulty_rank?: number;
  question_count: number;
  pretest_count?: number;
  time_limit_min: number;
  routing_rules?: RoutingRule[] | null;
}

export const testModulesApi = {
  list: async (testId: string): Promise<TestModulesResponse> => {
    const r = await apiClient.get<ApiResponse<TestModulesResponse>>(
      `${TESTS_BASE}/${testId}/modules`
    );
    return r.data.data;
  },
  create: async (testId: string, sectionId: string, data: CreateModulePayload) => {
    const r = await apiClient.post<ApiResponse<TestModule>>(
      `${TESTS_BASE}/${testId}/sections/${sectionId}/modules`,
      data
    );
    return r.data.data;
  },
  update: async (
    testId: string,
    moduleId: string,
    data: Partial<Omit<CreateModulePayload, "stage_no" | "variant">>
  ) => {
    const r = await apiClient.put<ApiResponse<TestModule>>(
      `${TESTS_BASE}/${testId}/modules/${moduleId}`,
      data
    );
    return r.data.data;
  },
  remove: async (testId: string, moduleId: string) => {
    await apiClient.delete(`${TESTS_BASE}/${testId}/modules/${moduleId}`);
  },
  addQuestions: async (
    testId: string,
    moduleId: string,
    items: Array<{ question_id: string; is_pretest?: boolean; order_index?: number }>
  ) => {
    const r = await apiClient.post<ApiResponse<{ added: number }>>(
      `${TESTS_BASE}/${testId}/modules/${moduleId}/questions`,
      { items }
    );
    return r.data.data;
  },
  updateQuestion: async (
    testId: string,
    moduleId: string,
    questionId: string,
    data: { is_pretest?: boolean; order_index?: number }
  ) => {
    await apiClient.put(
      `${TESTS_BASE}/${testId}/modules/${moduleId}/questions/${questionId}`,
      data
    );
  },
  removeQuestion: async (testId: string, moduleId: string, questionId: string) => {
    await apiClient.delete(
      `${TESTS_BASE}/${testId}/modules/${moduleId}/questions/${questionId}`
    );
  },
  saveScoreScales: async (
    testId: string,
    sectionId: string,
    scales: Array<{ path_key: string; scale: number[]; scale_max: number }>
  ): Promise<TestScoreScale[]> => {
    const r = await apiClient.put<ApiResponse<TestScoreScale[]>>(
      `${TESTS_BASE}/${testId}/sections/${sectionId}/score-scales`,
      { scales }
    );
    return r.data.data;
  },
  autoGenerateScoreScales: async (
    testId: string,
    sectionId: string,
    scaleMax: number
  ): Promise<TestScoreScale[]> => {
    const r = await apiClient.post<ApiResponse<TestScoreScale[]>>(
      `${TESTS_BASE}/${testId}/sections/${sectionId}/score-scales/auto-generate`,
      { scale_max: scaleMax }
    );
    return r.data.data;
  },
  saveNormTable: async (
    testId: string,
    points: TestNormTablePoint[] | null,
    maxScore: number
  ): Promise<TestNormTable | null> => {
    const r = await apiClient.put<ApiResponse<TestNormTable | null>>(
      `${TESTS_BASE}/${testId}/norm-table`,
      { points, max_score: maxScore }
    );
    return r.data.data;
  },
  autoGenerateNormTable: async (
    testId: string,
    maxScore: number
  ): Promise<TestNormTable | null> => {
    const r = await apiClient.post<ApiResponse<TestNormTable | null>>(
      `${TESTS_BASE}/${testId}/norm-table/auto-generate`,
      { max_score: maxScore }
    );
    return r.data.data;
  },
};

// ---- Health analytics ----
export interface AdaptiveHealth {
  totalAttempts: number;
  sections: Array<{
    sectionId: string;
    sectionName: string;
    paths: Array<{ pathKey: string; count: number; pct: number }>;
    modules: Array<{
      moduleId: string;
      stageNo: number;
      variant: string;
      attempts: number;
      avgRawCorrect: number | null;
      questionCount: number;
    }>;
  }>;
}

export interface QuestionHealthEntry {
  questionId: string;
  difficulty: string;
  declaredVsObserved: "MATCH" | "RELABEL_SUGGESTED" | "INSUFFICIENT_DATA";
  suggestedDifficulty: "EASY" | "MEDIUM" | "HARD" | null;
  attempts: number;
  pValue: number | null;
  pointBiserial: number | null;
  avgTimeSec: number | null;
  flags: string[];
}

export interface QuestionHealthResponse {
  questions: QuestionHealthEntry[];
  total: number;
  page: number;
  limit: number;
}

export const testHealthApi = {
  adaptiveHealth: async (testId: string): Promise<AdaptiveHealth> => {
    const r = await apiClient.get<ApiResponse<AdaptiveHealth>>(
      `${TESTS_BASE}/${testId}/adaptive-health`
    );
    return r.data.data;
  },
  questionHealth: async (
    bankId: string,
    params?: { page?: number; limit?: number }
  ): Promise<QuestionHealthResponse> => {
    const r = await apiClient.get<ApiResponse<QuestionHealthResponse>>(
      `${BANKS_BASE}/${bankId}/question-health${qs(params)}`
    );
    return r.data.data;
  },
};

export interface TestSeriesEntitlementUsage {
  productCode: "testseries_count";
  used: number;
  limit: number;
  isUnlimited: boolean;
  atCapacity: boolean;
}

export const testSeriesApi = {
  list: async (params?: {
    page?: number;
    limit?: number;
    status?: TestStatus;
    visibility?: TestSeriesVisibility;
    pricing_type?: TestSeriesPricingType;
    search?: string;
  }) => {
    const r = await apiClient.get<ApiResponse<SeriesListResponse>>(
      `${SERIES_BASE}${qs(params)}`
    );
    return r.data.data;
  },
  getEntitlementUsage: async (): Promise<TestSeriesEntitlementUsage> => {
    const r = await apiClient.get<ApiResponse<TestSeriesEntitlementUsage>>(
      `${SERIES_BASE}/entitlement-usage`
    );
    return r.data.data;
  },
  get: async (seriesId: string) => {
    const r = await apiClient.get<ApiResponse<TestSeries>>(`${SERIES_BASE}/${seriesId}`);
    return r.data.data;
  },
  create: async (data: CreateSeriesPayload) => {
    const r = await apiClient.post<ApiResponse<TestSeries>>(SERIES_BASE, data);
    return r.data.data;
  },
  update: async (seriesId: string, data: Partial<CreateSeriesPayload> & { status?: TestStatus }) => {
    const r = await apiClient.put<ApiResponse<TestSeries>>(
      `${SERIES_BASE}/${seriesId}`,
      data
    );
    return r.data.data;
  },
  delete: async (seriesId: string) => {
    await apiClient.delete(`${SERIES_BASE}/${seriesId}`);
  },
  publish: async (seriesId: string) => {
    const r = await apiClient.post<ApiResponse<TestSeries>>(
      `${SERIES_BASE}/${seriesId}/publish`
    );
    return r.data.data;
  },
  unpublish: async (seriesId: string) => {
    const r = await apiClient.post<ApiResponse<TestSeries>>(
      `${SERIES_BASE}/${seriesId}/unpublish`
    );
    return r.data.data;
  },
  // Tests in series
  listSeriesTests: async (seriesId: string) => {
    const r = await apiClient.get<ApiResponse<SeriesTestRow[]>>(
      `${SERIES_BASE}/${seriesId}/tests`
    );
    return r.data.data;
  },
  addTest: async (
    seriesId: string,
    data: { test_id: string; order_index?: number; is_free_preview?: boolean }
  ) => {
    const r = await apiClient.post<ApiResponse<SeriesTestRow>>(
      `${SERIES_BASE}/${seriesId}/tests`,
      data
    );
    return r.data.data;
  },
  removeTest: async (seriesId: string, testId: string) => {
    await apiClient.delete(`${SERIES_BASE}/${seriesId}/tests/${testId}`);
  },
  reorderTests: async (seriesId: string, orderedTestIds: string[]) => {
    const r = await apiClient.post<ApiResponse<{ reordered: number }>>(
      `${SERIES_BASE}/${seriesId}/tests/reorder`,
      { orderedTestIds }
    );
    return r.data.data;
  },
};

// ---- Scholarships ----
const SCHOLARSHIPS_BASE = "/tenant/test-scholarships";

export interface ScholarshipTier {
  min: number;
  label: string;
  amount?: number;
  currency?: string;
}

export interface Scholarship {
  id: string;
  testId: string | null;
  testSeriesId: string | null;
  name: string;
  description: string | null;
  basis: "PERCENT" | "SCALED";
  tiers: ScholarshipTier[];
  maxAwardees: number | null;
  status: string;
  createdAt: string;
}

export interface ScholarshipAward {
  id: string;
  scholarshipId: string;
  scholarshipName: string;
  memberId: string;
  memberName: string;
  memberEmail: string | null;
  attemptId: string | null;
  tierLabel: string | null;
  amount: number | null;
  currency: string | null;
  score: number | null;
  status: "PENDING" | "CONFIRMED" | "REJECTED";
  flaggedAt: string;
  decidedAt: string | null;
}

export interface CreateScholarshipPayload {
  test_id?: string | null;
  test_series_id?: string | null;
  name: string;
  description?: string | null;
  basis?: "PERCENT" | "SCALED";
  tiers: ScholarshipTier[];
  max_awardees?: number | null;
}

export const scholarshipsApi = {
  list: async (): Promise<Scholarship[]> => {
    const r = await apiClient.get<ApiResponse<Scholarship[]>>(SCHOLARSHIPS_BASE);
    return r.data.data ?? [];
  },
  create: async (data: CreateScholarshipPayload): Promise<Scholarship> => {
    const r = await apiClient.post<ApiResponse<Scholarship>>(SCHOLARSHIPS_BASE, data);
    return r.data.data;
  },
  update: async (id: string, data: Partial<CreateScholarshipPayload> & { status?: string }) => {
    const r = await apiClient.put<ApiResponse<Scholarship>>(`${SCHOLARSHIPS_BASE}/${id}`, data);
    return r.data.data;
  },
  remove: async (id: string) => {
    await apiClient.delete(`${SCHOLARSHIPS_BASE}/${id}`);
  },
  listAwards: async (params?: { scholarship_id?: string; status?: string }): Promise<ScholarshipAward[]> => {
    const r = await apiClient.get<ApiResponse<{ awards: ScholarshipAward[] }>>(
      `${SCHOLARSHIPS_BASE}/awards`,
      { params }
    );
    return r.data.data?.awards ?? [];
  },
  decideAward: async (awardId: string, status: "CONFIRMED" | "REJECTED") => {
    const r = await apiClient.patch<ApiResponse<{ id: string; status: string }>>(
      `${SCHOLARSHIPS_BASE}/awards/${awardId}`,
      { status }
    );
    return r.data.data;
  },
};

// ---- Descriptive grading ----
const GRADING_BASE = "/tenant/test-grading";

export type GradingAnswerStatus = "PENDING_REVIEW" | "MANUALLY_GRADED";

// NOTE: unlike the older test-series endpoints (which return camelCase), the
// grading read endpoints return snake_case fields exactly as documented in the
// backend contract. The grade POST response, however, is camelCase.

/** A single attempt awaiting evaluator grading (queue row). */
export interface PendingGradingAttempt {
  attempt_id: string;
  test_id: string;
  test_series_id: string | null;
  submitted_at: string | null;
  grading_status: string;
  score: number | null;
  test_name: string;
  series_title: string | null;
  learner_name: string;
  learner_email: string | null;
  /** Number of descriptive answers in this attempt still pending review. */
  pending_count: number;
}

export interface PendingGradingResponse {
  attempts: PendingGradingAttempt[];
  total: number;
}

/** Attempt header shown above the per-answer grading list. */
export interface GradingAttemptHeader {
  id: string;
  test_name: string;
  total_marks: number | null;
  series_title: string | null;
  learner_name: string;
  learner_email: string | null;
  grading_status: string;
  score: number | null;
  submitted_at: string | null;
}

/** One descriptive answer to grade. */
export interface GradingAnswer {
  answer_id: string;
  question_id: string;
  /** Student's free text, a plain string, `{ text }`, or null. */
  answer: unknown;
  marks_awarded: string | null;
  grading_status: GradingAnswerStatus;
  grader_remarks: string | null;
  graded_at: string | null;
  stem: unknown;
  /** Max marks for the question (string from the API). */
  marks: string;
  explanation: string | null;
}

export interface GradingAttemptDetail {
  attempt: GradingAttemptHeader;
  answers: GradingAnswer[];
}

export interface GradeAnswerResult {
  graded: boolean;
  attemptId: string;
  score: number;
  gradingStatus: string;
}

export const testGradingApi = {
  listPending: async (params?: {
    test_id?: string;
    test_series_id?: string;
    page?: number;
    limit?: number;
  }): Promise<PendingGradingResponse> => {
    const r = await apiClient.get<ApiResponse<PendingGradingResponse>>(
      `${GRADING_BASE}/pending${qs(params)}`
    );
    return r.data.data;
  },
  getAttempt: async (attemptId: string): Promise<GradingAttemptDetail> => {
    const r = await apiClient.get<ApiResponse<GradingAttemptDetail>>(
      `${GRADING_BASE}/attempts/${attemptId}`
    );
    return r.data.data;
  },
  gradeAnswer: async (
    answerId: string,
    data: { marksAwarded: number; remarks?: string }
  ): Promise<GradeAnswerResult> => {
    const r = await apiClient.post<ApiResponse<GradeAnswerResult>>(
      `${GRADING_BASE}/answers/${answerId}/grade`,
      data
    );
    return r.data.data;
  },
};

// ── Question taxonomy (fixed subject/chapter/topic) + blueprint availability ──

const TAXONOMY_BASE = "/tenant/test-taxonomy";

export type TaxonomyKind = "SUBJECT" | "CHAPTER" | "TOPIC";

export interface TaxonomyNode {
  id: string;
  tenantId: string;
  kind: TaxonomyKind;
  parentId: string | null;
  name: string;
  orderIndex: number;
  createdAt: string;
  updatedAt: string;
}

export interface BlueprintRule {
  id?: string;
  subjectNodeId?: string | null;
  chapterNodeId?: string | null;
  topicNodeId?: string | null;
  difficulty?: "EASY" | "MEDIUM" | "HARD" | "ANY";
  mode?: "COUNT" | "PERCENT";
  value?: number;
}

export interface SectionBlueprint {
  mode?: "BLUEPRINT";
  totalCount?: number;
  rules: BlueprintRule[];
}

export interface BlueprintAvailability {
  ok: boolean;
  rules: Array<{
    ruleId: string | null;
    requested: number;
    available: number;
    short: number;
  }>;
}

export const testTaxonomyApi = {
  list: async (kind?: TaxonomyKind, parentId?: string) => {
    const params: Record<string, string> = {};
    if (kind) params.kind = kind;
    if (parentId) params.parentId = parentId;
    const r = await apiClient.get<ApiResponse<TaxonomyNode[]>>(TAXONOMY_BASE, {
      params,
    });
    return r.data.data ?? [];
  },
  create: async (data: {
    kind: TaxonomyKind;
    name: string;
    parentId?: string | null;
    orderIndex?: number;
  }) => {
    const r = await apiClient.post<ApiResponse<TaxonomyNode>>(TAXONOMY_BASE, data);
    return r.data.data;
  },
  update: async (
    nodeId: string,
    data: { name?: string; parentId?: string | null; orderIndex?: number }
  ) => {
    const r = await apiClient.put<ApiResponse<TaxonomyNode>>(
      `${TAXONOMY_BASE}/${nodeId}`,
      data
    );
    return r.data.data;
  },
  remove: async (nodeId: string) => {
    await apiClient.delete(`${TAXONOMY_BASE}/${nodeId}`);
  },
  checkAvailability: async (data: {
    questionBankId: string;
    totalCount?: number;
    rules: BlueprintRule[];
  }) => {
    const r = await apiClient.post<ApiResponse<BlueprintAvailability>>(
      `${TAXONOMY_BASE}/availability`,
      data
    );
    return r.data.data;
  },
  importFromTags: async () => {
    const r = await apiClient.post<
      ApiResponse<{
        subjects: number;
        chapters: number;
        topics: number;
        questionsTagged: number;
      }>
    >(`${TAXONOMY_BASE}/import-from-tags`);
    return r.data.data;
  },
};
