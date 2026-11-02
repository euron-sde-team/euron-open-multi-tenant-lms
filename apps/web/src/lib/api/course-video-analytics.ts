/**
 * Course video analytics API client, per-video time spent for the
 * authenticated learner with a comparison to the cohort (peer) average.
 * Requires authentication and enrollment in the course.
 */

import { apiGet } from "./api-client";
import { deepDecodeHtmlEntities } from "../utils";

export interface CourseVideoAnalyticsVideo {
  lectureId: string;
  title: string;
  sectionTitle: string;
  durationSeconds: number;
  yourSeconds: number;
  avgSeconds: number;
  yourCompleted: boolean;
  peerCompletionPercent: number;
}

export interface CourseVideoAnalyticsSummary {
  yourTotalSeconds: number;
  avgTotalSeconds: number;
  yourCompletedVideos: number;
  totalVideos: number;
  yourProgressPercent: number;
  avgProgressPercent: number;
  peerCount: number;
}

export interface CourseVideoAnalyticsData {
  course: { id: string; title: string };
  summary: CourseVideoAnalyticsSummary;
  videos: CourseVideoAnalyticsVideo[];
}

export async function getCourseVideoAnalytics(
  courseId: string
): Promise<CourseVideoAnalyticsData> {
  // Decode sanitizer-escaped entities (e.g. "&amp;") in titles at the boundary
  // so every consumer renders clean text.
  const data = await apiGet<CourseVideoAnalyticsData>(
    `/courses/${courseId}/video-analytics`
  );
  return deepDecodeHtmlEntities(data);
}
