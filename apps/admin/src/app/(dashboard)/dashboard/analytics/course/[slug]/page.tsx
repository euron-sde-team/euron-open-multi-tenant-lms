"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

/**
 * Legacy route: /dashboard/analytics/course/[slug]
 * Redirects to the combined courses-analytics list.
 * Use /dashboard/analytics/courses-analytics/[courseId] for per-course detail.
 */
export default function CourseAnalyticsRedirectPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/dashboard/analytics/courses-analytics");
  }, [router]);

  return null;
}
