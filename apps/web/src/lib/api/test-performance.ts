import { apiGet, apiPost } from "./api-client";

export interface PerfBucket {
  label: string;
  subject?: string | null;
  total: number;
  correct: number;
  accuracy: number;
}

export interface PerfRecentActivity {
  source: "TEST" | "PRACTICE";
  id: string;
  title: string | null;
  score: number | null;
  totalMarks: number | null;
  at: string;
}

export interface PerformanceDashboard {
  overall: { questionsAnswered: number; correct: number; accuracy: number };
  bySubject: PerfBucket[];
  byDomain: PerfBucket[];
  bySkill: PerfBucket[];
  byDifficulty: PerfBucket[];
  byType: PerfBucket[];
  strengths: PerfBucket[];
  weaknesses: PerfBucket[];
  recommendations: string[];
  recentActivity: PerfRecentActivity[];
}

export interface ScoreCalcResult {
  sections: {
    name: string;
    rawCorrect: number;
    totalQuestions: number;
    scaled: number;
  }[];
  total: number;
  maxTotal: number;
  estimate: true;
}

export const testPerformanceApi = {
  dashboard: () => apiGet<PerformanceDashboard>("/test-performance/dashboard"),

  scoreCalculator: (
    sections: { name?: string; rawCorrect: number; totalQuestions: number }[]
  ) =>
    apiPost<ScoreCalcResult>("/test-performance/score-calculator", { sections }),
};

export default testPerformanceApi;
