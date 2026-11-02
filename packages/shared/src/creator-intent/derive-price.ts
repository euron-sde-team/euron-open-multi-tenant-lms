import type { QuizAnswers } from "./types";

// Heuristic price grid (₹ INR). Tuned to revenue intent × course delivery type.
// Goal: a sensible starting price the creator can edit later, not perfect.
export function derivePriceINR(
  revenueIntent: QuizAnswers["revenue_intent"],
  courseType: QuizAnswers["course_type"],
): number {
  const isLive =
    courseType === "Live classes" ||
    courseType === "Cohort programs" ||
    courseType === "Mentorship";
  const isTestSeries = courseType === "Test series";
  const isCommunity = courseType === "Community";

  switch (revenueIntent) {
    case "Below ₹50k":
      if (isLive) return 1499;
      if (isTestSeries) return 299;
      if (isCommunity) return 199;
      return 499;
    case "₹50k–₹2L":
      if (isLive) return 4999;
      if (isTestSeries) return 499;
      if (isCommunity) return 499;
      return 999;
    case "₹2L–₹10L":
      if (isLive) return 14999;
      if (isTestSeries) return 999;
      if (isCommunity) return 999;
      return 2999;
    case "₹10L+":
      if (isLive) return 29999;
      if (isTestSeries) return 1499;
      if (isCommunity) return 1499;
      return 4999;
  }
}
