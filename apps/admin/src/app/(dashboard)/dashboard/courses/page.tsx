"use client";

import { CoursesAllListView } from "@/components/courses/courses-all-list-view";
import { FeatureGate } from "@/components/feature-gate/FeatureGate";

/**
 * Root /dashboard/courses page.
 * Shows all self-paced courses with infinite scroll.
 */
export default function CoursesIndexPage() {
  return (
    <FeatureGate featureKeys={["self_paced_courses"]}>
      <CoursesAllListView />
    </FeatureGate>
  );
}
