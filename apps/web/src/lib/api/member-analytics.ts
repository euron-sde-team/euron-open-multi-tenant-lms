import { apiGet } from "./api-client";
import { deepDecodeHtmlEntities } from "../utils";

export interface MemberAnalyticsData {
  overview: {
    totalCoursesEnrolled: number;
    coursesCompleted: number;
    completionRate: number;
    totalLearningHours: number;
    certificatesEarned: number;
    totalQuizAttempts: number;
    averageQuizScore: number;
    currentStreak: number;
  };
  learningProgress: {
    courseProgress: Array<{
      courseId: string;
      courseTitle: string;
      status: string;
      enrolledAt: string;
      totalLectures: number;
      completedLectures: number;
      progressPercent: number;
    }>;
    weeklyActivity: Array<{ week: string; hours: number }>;
    timeByCourse: Array<{ courseTitle: string; hours: number }>;
  };
  assessments: {
    quizScores: Array<{
      quizId: string;
      score: number;
      totalMarks: number;
      percent: number;
      completedAt: string;
    }>;
    assignmentStats: { total: number; completed: number; pending: number };
  };
  contentEngagement: {
    reviews: { count: number; averageRating: number };
    bookmarks: { courses: number; books: number; bundles: number };
  };
  sessions: {
    recentSessions: Array<{
      id: string;
      deviceInfo: string | null;
      isActive: boolean;
      createdAt: string;
      lastSeenAt: string;
    }>;
    activeSessions: number;
    loginFrequency: Array<{ day: string; count: number }>;
  };
  financial: {
    totalSpent: number;
    currency: string;
    purchaseBreakdown: Array<{ orderType: string; count: number; amount: number }>;
  };
  dailyActivity: Array<{ day: string; minutes: number; actions: number }>;
}

export interface MemberCertificate {
  id: string;
  certificateNumber: string;
  /** COURSE = completing a course; TEST_SERIES = passing a test; BULK = admin-issued. */
  type: "COURSE" | "TEST_SERIES" | "BULK";
  /** Unified display title (course title, test-series title, or bulk batch title). */
  title: string;
  courseId: string | null;
  courseTitle: string | null;
  status: string;
  issuedAt: string;
  /** Tenant-authoritative verify URL (owning tenant's real domain). */
  verifyUrl: string;
}

export const memberAnalyticsApi = {
  // Decode sanitizer-escaped entities (e.g. "&amp;") in course titles/names at
  // the boundary so every consumer renders clean text.
  getAnalytics: (): Promise<MemberAnalyticsData> =>
    apiGet<MemberAnalyticsData>("/member/analytics").then(
      deepDecodeHtmlEntities
    ),
  getCertificates: (): Promise<MemberCertificate[]> =>
    apiGet<MemberCertificate[]>("/member/certificates").then(
      deepDecodeHtmlEntities
    ),
};
