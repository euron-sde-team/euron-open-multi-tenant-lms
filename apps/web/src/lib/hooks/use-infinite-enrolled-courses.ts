import { useInfiniteQuery } from "@tanstack/react-query";
import { fetchCourseList } from "@/lib/api";
import type { CourseMode } from "@/lib/api";

export const ENROLLED_COURSES_QUERY_KEY = ["courses", "enrolled", "infinite"] as const;
export const ENROLLED_COURSES_PAGE_SIZE = 24;

export type EnrolledCourseFilter =
  | "all"
  | "FREE"
  | "PAID"
  | "SELF_PACED"
  | "LIVE"
  | "HYBRID"
  | "complete";

export function useInfiniteEnrolledCourses(
  host: string | undefined,
  filter?: EnrolledCourseFilter
) {
  const mode: CourseMode | undefined =
    filter === "SELF_PACED" || filter === "LIVE" || filter === "HYBRID"
      ? filter
      : undefined;
  const purchaseMode =
    filter === "FREE" || filter === "PAID" ? filter : undefined;
  const completedOnly = filter === "complete";

  return useInfiniteQuery({
    queryKey: [...ENROLLED_COURSES_QUERY_KEY, host ?? "client", filter ?? "all"],
    queryFn: async ({ pageParam }) => {
      const page = pageParam as number;
      const result = await fetchCourseList(
        {
          mode,
          page,
          limit: ENROLLED_COURSES_PAGE_SIZE,
          enrolledOnly: true,
          purchaseMode,
          completedOnly,
        },
        host!
      );
      return {
        courses: result.courses,
        total: result.total,
        page: result.page,
        limit: result.limit,
        hasMore: result.page * result.limit < result.total,
      };
    },
    initialPageParam: 1,
    getNextPageParam: (lastPage) =>
      lastPage.hasMore ? lastPage.page + 1 : undefined,
    enabled: !!host,
    staleTime: 60 * 1000,
    retry: 3,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 10000),
  });
}
