"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

/**
 * Assignments are managed from the LMS editor.
 * Redirect to courses to access the LMS editor.
 */
export default function AssignmentsRedirectPage() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/dashboard/courses");
  }, [router]);
  return null;
}
