import { useInfiniteQuery } from "@tanstack/react-query";

import { coursesApi } from "../api/courses";

export const COURSES_LMS_QUERY_KEY = ["courses", "lms", "infinite"] as const;
export const COURSES_LMS_PAGE_SIZE = 24;

export type CourseModeFilter = "SELF_PACED" | "ALL";

export function useInfiniteCoursesLms(
  tenantId: string | undefined,
  modeFilter?: CourseModeFilter
) {
  const mode = modeFilter && modeFilter !== "ALL" ? modeFilter : undefined;
  const courseType = "NORMAL";

  return useInfiniteQuery({
    queryKey: [...COURSES_LMS_QUERY_KEY, tenantId ?? "", modeFilter ?? "ALL"],
    queryFn: async ({ pageParam }) => {
      const page = pageParam as number;
      const result = await coursesApi.getCourses(
        tenantId!,
        page,
        COURSES_LMS_PAGE_SIZE,
        { mode, courseType }
      );
      const hasMore = result.page * result.limit < result.total;
      return {
        ...result,
        hasMore,
      };
    },
    initialPageParam: 1,
    getNextPageParam: (lastPage) =>
      lastPage.hasMore ? lastPage.page + 1 : undefined,
    enabled: !!tenantId,
    retry: 2,
  });
}
