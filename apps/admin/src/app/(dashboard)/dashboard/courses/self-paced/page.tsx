"use client";

import { CourseListView } from "@/components/courses/course-list-view";
import { FeatureGate } from "@/components/feature-gate/FeatureGate";

export default function SelfPacedCoursesPage() {
  return (
    <FeatureGate featureKeys={["self_paced_courses"]}>
      <CourseListView mode="SELF_PACED" />
    </FeatureGate>
  );
}
