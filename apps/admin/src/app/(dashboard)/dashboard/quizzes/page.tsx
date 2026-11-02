"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

/**
 * Quizzes are managed from the course LMS editor.
 * Redirect to courses to access the LMS editor.
 */
export default function QuizzesRedirectPage() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/dashboard/courses");
  }, [router]);
  return null;
}
