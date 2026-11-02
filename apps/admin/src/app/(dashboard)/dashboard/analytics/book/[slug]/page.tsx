"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

/**
 * Legacy route: /dashboard/analytics/book/[slug]
 * Redirects to the combined books-analytics list.
 * Use /dashboard/analytics/books-analytics/[bookId] for per-book detail.
 */
export default function BookAnalyticsRedirectPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/dashboard/analytics/books-analytics");
  }, [router]);

  return null;
}
